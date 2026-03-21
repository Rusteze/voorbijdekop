type ResponsesClient = {
  responses: {
    create: (payload: any) => Promise<any>;
  };
};

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ note: "Unserializable payload" }, null, 2);
  }
}

function shouldDebug() {
  return process.env.DEBUG_LLM === "true";
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars).trimEnd() + "…";
}

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n");
}

function findMarkerIndexUpper(input: string, marker: string) {
  const upper = input.toUpperCase();
  const m = marker.toUpperCase();
  return upper.indexOf(m);
}

function sliceBetweenMarkers(input: string, startMarker: string, endMarkers: string[]) {
  const startIdx = findMarkerIndexUpper(input, startMarker);
  if (startIdx < 0) return null;

  const upper = input.toUpperCase();
  let endIdx = -1;
  for (const m of endMarkers) {
    const idx = upper.indexOf(m.toUpperCase(), startIdx + startMarker.length);
    if (idx < 0) continue;
    if (endIdx < 0 || idx < endIdx) endIdx = idx;
  }

  return input.slice(startIdx, endIdx >= 0 ? endIdx : input.length);
}

function breakdownPromptInput(rawInput: unknown) {
  if (typeof rawInput !== "string") {
    return {
      ok: false as const,
      rawPreview: truncate(String(rawInput ?? ""), 800)
    };
  }

  const input = normalizeNewlines(rawInput);

  const systemBlock = (sliceBetweenMarkers(input, "SYSTEM:", ["CONTEXT:", "INSTRUCTIE:", "OUTPUT:"]) ?? "").trim();
  const contextBlock = (sliceBetweenMarkers(input, "CONTEXT:", ["INSTRUCTIE:", "OUTPUT:"]) ?? "").trim();
  const instructieBlock = (sliceBetweenMarkers(input, "INSTRUCTIE:", ["OUTPUT:"]) ?? "").trim();

  const instructionUpper = instructieBlock?.toUpperCase?.() ?? "";
  const belIdx = instructionUpper.indexOf("BELANGRIJK");
  const regelsIdx = instructionUpper.indexOf("REGELS:");

  let instructionBlock: string | undefined = instructieBlock;
  let outputFormatBlock: string | undefined;

  if (belIdx >= 0) {
    instructionBlock = instructieBlock?.slice(0, belIdx).trim();
    outputFormatBlock = instructieBlock?.slice(belIdx).trim();
  } else if (regelsIdx >= 0) {
    // Voor vertalingen: “INSTRUCTIE” is vaak enkel header, “OUTPUT FORMAT” = regels vanaf “Regels:”
    instructionBlock = instructieBlock?.slice(0, regelsIdx).trim();
    outputFormatBlock = instructieBlock?.slice(regelsIdx).trim();
  }

  const toneBlock = systemBlock ?? "";
  const instruction = instructionBlock ?? instructieBlock ?? "";
  const context = contextBlock ?? "";
  const outputFormat = outputFormatBlock ?? "";

  // Heuristisch: probeer “Stijl:” als extra tone guidance te vangen.
  const stijlIdx = instructionUpper.indexOf("STIJL:");
  let toneStyleHint = "";
  if (stijlIdx >= 0) {
    const stijlSlice = instructieBlock?.slice(stijlIdx, stijlIdx + 600) ?? "";
    toneStyleHint = stijlSlice.trim();
  }

  const ok = Boolean(systemBlock || contextBlock || instructieBlock);

  return {
    ok: ok as boolean,
    okReason: ok ? "markers gevonden" : "markers niet gevonden",
    tone: [toneBlock, toneStyleHint].filter(Boolean).join("\n"),
    context,
    instruction,
    outputFormat
  };
}

function estimateTokens(chars: number) {
  // Heuristische schatting: NL prompt is vaak ~3-5 chars per token
  return Math.max(1, Math.round(chars / 4));
}

function analyzePrompt(input: string) {
  const totalChars = input.length;
  const estimatedTokens = estimateTokens(totalChars);

  const breakdown = breakdownPromptInput(input);
  const instruction = (breakdown as any).instruction ?? null;
  const context = (breakdown as any).context ?? null;
  const outputFormat = (breakdown as any).outputFormat ?? null;
  const tone = (breakdown as any).tone ?? null;

  const issues: string[] = [];
  const suggestions: string[] = [];

  if (totalChars > 8000) {
    issues.push(`Prompt is erg lang (${totalChars} chars).`);
    suggestions.push("Overweeg context te verkorten of meer aggressive excerpt trimming toe te passen.");
  }

  const contextLen = typeof context === "string" ? context.length : 0;
  const instructionLen = typeof instruction === "string" ? instruction.length : 0;
  const contextDominates = totalChars > 0 ? contextLen / totalChars > 0.7 : false;
  if (contextDominates) {
    issues.push("Context domineert (mogelijk te weinig ruimte/gewicht voor instructies).");
    suggestions.push("Maak instructies explicieter en/of reduceer het aandeel bronnen/context.");
  }

  const instructionText = typeof instruction === "string" ? instruction.toLowerCase() : "";
  const taskVerbs = [
    /schrijf\b/,
    /maak\b/,
    /verkort\b/,
    /analyse(er|s|)\b/,
    /samenvat\b/,
    /formuleer\b/,
    /geef\b/,
    /onderzo(e|ek)\b/
  ];
  const hasVerb = taskVerbs.some((rx) => rx.test(instructionText));
  if (!hasVerb) {
    issues.push("Instruction bevat geen duidelijke taak-werkwoorden (heuristiek).");
    suggestions.push("Voeg een expliciete taakregel toe met een sterk werkwoord (bijv. 'Maak...', 'Analyseer...', 'Schrijf...').");
  }

  const isInstructionWeak = instructionLen < 180;
  if (isInstructionWeak && hasVerb === false) {
    issues.push("Instruction lijkt relatief zwak/compact vergeleken met promptlengte.");
    suggestions.push("Versterk de instruction met concrete outputregels en verificatie-eisen.");
  }

  const inputLower = input.toLowerCase();
  const outputEnforced =
    /json schema|json_schema|schemaobject|moet geldig json|geldig json|json\b/i.test(inputLower) ||
    (typeof outputFormat === "string" ? outputFormat.length > 0 : false);

  if (!outputEnforced) {
    issues.push("Output format lijkt niet sterk genoeg afgedwongen (heuristiek).");
    suggestions.push("Voeg expliciete JSON/Schema enforcement toe (bijv. 'output MOET geldig JSON zijn volgens schema').");
  }

  const toneLower = (typeof tone === "string" ? tone : input).toLowerCase();
  const toneHints = [/journalist/, /onderzoek/, /analytisch/, /neutral/, /rustig/, /sensatie/];
  const hasTone = toneHints.some((rx) => rx.test(toneLower));
  if (!hasTone) {
    issues.push("Tone/style guidance is mogelijk afwezig of te zwak (heuristiek).");
    suggestions.push("Voeg tone keywords toe (bijv. 'journalist', 'neutraal', 'analytisch') of breid toneBlock uit.");
  }

  // Redundancy: detecteer herhaalde “niet al te lange” regels.
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.length >= 12 && l.length <= 90);

  const counts = new Map<string, number>();
  for (const l of lines.slice(0, 600)) {
    const key = l.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1]).find(([, c]) => c >= 3);
  if (repeated) {
    issues.push("Mogelijke redundantie: meerdere herhaalde regels in prompt.");
    suggestions.push("Overweeg redundante secties samen te voegen of dubbele regels te verwijderen waar mogelijk.");
  }

  return {
    length: { characters: totalChars, estimatedTokens },
    sections: {
      instruction: typeof instruction === "string" ? truncate(instruction, 2500) : null,
      context: typeof context === "string" ? truncate(context, 2500) : null,
      output_format: typeof outputFormat === "string" ? truncate(outputFormat, 2500) : null,
      tone: typeof tone === "string" ? truncate(tone, 1500) : null
    },
    issues,
    suggestions
  };
}

export async function openAiResponsesCreate(
  client: ResponsesClient,
  payload: any,
  debug: { name: string; context?: Record<string, unknown> }
) {
  if (shouldDebug()) {
    const debugPayload = {
      type: "openai.responses.create",
      name: debug.name,
      ...(debug.context ?? {}),
      model: payload?.model,
      input: payload?.input,
      text: payload?.text,
      // Ook de rest van de payload (zoals format/schema) loggen indien aanwezig
      // zodat je exact kan tunen op het requestniveau.
      fullPayload: payload
    };

    const breakdown = breakdownPromptInput(payload?.input);

    console.log(`[llm debug] ${debug.name} request:\n${safeJsonStringify(debugPayload)}`);

    if (typeof payload?.input === "string") {
      const analysis = analyzePrompt(payload.input);
      console.log("\n===== PROMPT ANALYSIS =====");
      console.log(
        `Length: ${analysis.length.characters} chars (~${analysis.length.estimatedTokens} tokens)`
      );
      if (analysis.issues.length > 0) {
        console.log("\nIssues:");
        for (const issue of analysis.issues) console.log(`- ${issue}`);
      } else {
        console.log("\nIssues: (geen) ");
      }

      if (analysis.suggestions.length > 0) {
        console.log("\nSuggestions:");
        for (const s of analysis.suggestions) console.log(`- ${s}`);
      } else {
        console.log("\nSuggestions: (geen) ");
      }
      console.log("===========================\n");
    }

    if (breakdown.ok) {
      console.log("\n===== LLM PROMPT BREAKDOWN =====");
      console.log("INSTRUCTION:");
      console.log(truncate(breakdown.instruction ?? "", 1400) || "(leeg)");
      console.log("\nCONTEXT:");
      console.log(truncate(breakdown.context ?? "", 1400) || "(leeg)");
      console.log("\nOUTPUT FORMAT:");
      console.log(truncate(breakdown.outputFormat ?? "", 1400) || "(leeg)");
      console.log("\nTONE / STYLE:");
      console.log(truncate(breakdown.tone ?? "", 800) || "(leeg)");
      console.log("=================================\n");

      console.log("[llm debug] structured prompt:", {
        instruction: truncate(breakdown.instruction ?? "", 500),
        context: truncate(breakdown.context ?? "", 500),
        output_format: truncate(breakdown.outputFormat ?? "", 500),
        tone: truncate(breakdown.tone ?? "", 250),
        debugName: debug.name
      });
    } else {
      console.log("\n===== LLM PROMPT BREAKDOWN =====");
      console.log("FALLBACK PREVIEW (markers niet gevonden)");
      console.log(breakdown.rawPreview);
      console.log("=================================");
    }
  }

  return client.responses.create(payload);
}


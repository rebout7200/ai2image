import type { AnalysisData } from '../types';
import { initialAnalysisData } from '../types';

// A simple but effective way to parse streaming JSON
// It finds the largest valid JSON object from the end of the string.
export function parseStreamingJson(jsonString: string): Partial<AnalysisData> {
  try {
    // First, try parsing the whole string. If it works, we are done.
    return JSON.parse(jsonString);
  } catch (e) {
    // If it fails, it's likely an incomplete stream.
    // We will try to find the last complete key-value pair or object.
    
    let lastValidJson = "{}";
    
    // Find the last closing brace '}' which could signify the end of an object.
    const lastBrace = jsonString.lastIndexOf('}');
    if (lastBrace > 0) {
        // Find the matching opening brace '{' to get the full object string.
        const firstBrace = jsonString.indexOf('{');
        if (firstBrace !== -1) {
            let potentialJson = jsonString.substring(firstBrace, lastBrace + 1);
            try {
                 JSON.parse(potentialJson);
                 lastValidJson = potentialJson;
            } catch (err) {
                // The substring is not a valid object, it might be partial.
                // Let's find the last comma before the last brace.
                const lastComma = potentialJson.lastIndexOf(',');
                if (lastComma > 0) {
                    potentialJson = potentialJson.substring(0, lastComma) + "}";
                    try {
                        JSON.parse(potentialJson);
                        lastValidJson = potentialJson;
                    } catch (err2) {
                        // Still not valid, we'll return the last known good state.
                    }
                }
            }
        }
    }
    
    try {
        return JSON.parse(lastValidJson);
    } catch (finalError) {
        // If everything fails, return an empty object.
        return initialAnalysisData;
    }
  }
}

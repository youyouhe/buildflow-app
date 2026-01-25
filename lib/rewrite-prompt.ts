import { EnhancedSettings } from "@/types";
import { PROMPT_FOR_REWRITE_PROMPT, PROMPT_FOR_REWRITE_PROMPT_END } from "./prompts";

export async function rewritePrompt(prompt: string, enhancedSettings: EnhancedSettings, options: { token: string, billTo: string | null }, model: string, provider: string) {
  // Return the original prompt with settings appended
  
  let enhancedPrompt = prompt;
  
  if (enhancedSettings.isActive) {
    const settingsParts = [];
    
    if (enhancedSettings.primaryColor) {
      settingsParts.push(`primary color: ${enhancedSettings.primaryColor}`);
    }
    
    if (enhancedSettings.secondaryColor) {
      settingsParts.push(`secondary color: ${enhancedSettings.secondaryColor}`);
    }
    
    if (enhancedSettings.theme) {
      settingsParts.push(`${enhancedSettings.theme} mode theme`);
    }
    
    if (settingsParts.length > 0) {
      enhancedPrompt += `\n\nAdditional requirements:\n- Use ${settingsParts.join(', ')}`;
    }
  }
  
  return enhancedPrompt;
}
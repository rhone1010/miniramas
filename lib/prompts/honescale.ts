import fs from 'fs'
import path from 'path'

interface PromptsConfig {
  base_prompt: string
  memory_enhancement: string
  styles: Record<string, string>
}

function loadPrompts(): PromptsConfig {
  const filePath = path.join(process.cwd(), 'data/prompts.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function buildPrompt(style: string): string {
  const prompts = loadPrompts()
  const stylePrompt = prompts.styles[style] || prompts.styles['landscape_diorama']
  
  return `${prompts.base_prompt}\n\n${stylePrompt}\n\n${prompts.memory_enhancement}`
}
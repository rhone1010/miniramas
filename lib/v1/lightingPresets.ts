export const LIGHTING_PRESETS: Record<string, { label: string; prompt: string }> = {
  midday_summer: {
    label: 'Midday Summer Sun',
    prompt: `
LIGHTING MODE: MIDDAY SUMMER SUN
- Strong, direct overhead sunlight with crisp shadows
- High contrast with bright highlights and defined edges
- Neutral-warm color temperature
- Clear sky feel, vibrant and energetic
- Strong specular highlights on surfaces (wood, glass, foliage)
`.trim()
  },
  soft_spring: {
    label: 'Soft Spring Afternoon',
    prompt: `
LIGHTING MODE: SOFT SPRING AFTERNOON
- Diffused, gentle sunlight with soft shadow edges
- Slight warm tone with balanced ambient light
- Low contrast, smooth transitions between light and shadow
- Calm, natural, slightly romantic atmosphere
- Subtle glow in foliage and surfaces
`.trim()
  },
  dusk_evening: {
    label: 'Evening (Dusk) Glow',
    prompt: `
LIGHTING MODE: DUSK EVENING
- Low-angle warm sunlight (golden hour)
- Long soft shadows stretching across base
- Warm orange-pink highlights with cooler shadow tones
- Interior lights more pronounced and glowing
- Atmosphere slightly dim but rich in color depth
`.trim()
  },
  night: {
    label: 'Nighttime Scene',
    prompt: `
LIGHTING MODE: NIGHT
- Primary lighting from porch lights, interior lights, and subtle moonlight
- Cool ambient tones with warm localized light sources
- Soft falloff of light into darkness
- Reflections visible but subdued
- High contrast between lit areas and shadow
`.trim()
  }
}

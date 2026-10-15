import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// A numeric spec that may genuinely be unknown/unpublished for a given
// model (e.g. STI-550HD's oxy-fuel capacity was never listed on the
// original site). Use `null` rather than guessing — the UI renders
// "Data required" for a null value instead of a fabricated number.
const optionalInches = z.number().positive().nullable();

const machineSchema = z.object({
  name: z.string(), // Display name, e.g. "STI-550HD"
  urlSlug: z.string(), // Routing slug, e.g. "sti-550hd"
  tier: z.string(), // Short category label, e.g. "Precision / High-Speed"
  tagline: z.string(), // One-line positioning sentence
  overview: z.string(), // Full descriptive paragraph(s), typo-corrected
  heroImage: z.string(), // Path under /images/machines/
  heroImageAlt: z.string(), // Required — every image ships real alt text

  specs: z.object({
    cutWidthFt: z.tuple([z.number(), z.number()]),
    cutLengthFt: z.tuple([z.number(), z.number()]),
    contouringSpeedIpm: z.tuple([z.number(), z.number()]),
    traverseSpeedIpm: z.tuple([z.number(), z.number()]),
    lifterSpeedPlasmaIpm: z.number().nullable(),
    lifterSpeedOxyFuelIpm: z.number().nullable(),
    plasmaMildSteelIn: optionalInches,
    plasmaAluminumStainlessIn: optionalInches,
    oxyFuelIn: optionalInches,
  }),

  // The source site labels this section "Process Capacity" for most
  // models but "Maximum Stations" for Spectrum — preserved rather than
  // normalized away.
  capacitySectionLabel: z.string().default('Process Capacity'),

  // Free-form rows for that block, which is genuinely structured
  // differently per model on the source site (e.g. "Plasma: Up to 2 /
  // Oxy-Fuel: Up to 10" vs "Plasma/Oxy-Fuel: 3 total" vs "Plasma up to 2
  // heads") rather than forcing one shape.
  capacityNotes: z.array(z.object({ label: z.string(), value: z.string() })),

  // STI-800HD only: its unique drilling/counterboring/countersinking spec.
  drillingCapacity: z
    .object({
      drillingIn: z.number(),
      counterboringIn: z.number(),
      countersinkingIn: z.number(),
    })
    .optional(),

  standardEquipment: z.array(z.string()),
  optionalEquipment: z.array(z.string()),

  // Explicit data gaps carried over from the source site rather than
  // silently filled in — surfaced on the page and in Items Requiring
  // Your Input, per the audit/competitive-brief findings.
  dataGaps: z.array(z.string()).default([]),
});

const machines = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/machines' }),
  schema: machineSchema,
});

export const collections = { machines };

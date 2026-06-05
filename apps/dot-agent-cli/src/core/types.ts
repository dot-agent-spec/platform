import { ParsedDescription } from '../types.js'

export function buildTypesJson(description: ParsedDescription): object | null {
  const capabilities = description.capabilities || []

  const publicCapabilities = capabilities.filter((cap: any) => cap.public !== false)
  if (publicCapabilities.length === 0) return null

  const types: any = {
    input: [],
    output: [],
    $defs: {},
  }

  for (const cap of publicCapabilities) {
    if (cap.inputType) {
      if (typeof cap.inputType === 'string' && cap.inputType.startsWith('std.')) {
        types.input.push({
          $ref: `https://dot-agent.dev/schema/std/v1/${cap.inputType.replace('std.', '')}.json`,
        })
      } else if (typeof cap.inputType === 'object') {
        const typeName = cap.name ? `${cap.name}Input` : 'Input'
        types.input.push({ $ref: `#/$defs/${typeName}` })
        types.$defs[typeName] = cap.inputType
      }
    }

    if (cap.outputType) {
      if (typeof cap.outputType === 'string' && cap.outputType.startsWith('std.')) {
        types.output.push({
          $ref: `https://dot-agent.dev/schema/std/v1/${cap.outputType.replace('std.', '')}.json`,
        })
      } else if (typeof cap.outputType === 'object') {
        const typeName = cap.name ? `${cap.name}Output` : 'Output'
        types.output.push({ $ref: `#/$defs/${typeName}` })
        types.$defs[typeName] = cap.outputType
      }
    }
  }

  if (Object.keys(types.$defs).length === 0) delete types.$defs

  if (types.input.length === 0 && types.output.length === 0) return null

  return types
}

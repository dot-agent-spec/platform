// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { DescriptionFile, TypeDefinition, PropertyType, AnnotatedRef } from './types.js'

const STD_BASE = 'https://dot-agent.dev/schema/std/v1/'

function propertyTypeToSchema(pt: PropertyType): object {
  switch (pt.kind) {
    case 'primitive':
      return { type: pt.value }
    case 'reference':
      return pt.value.startsWith('std.')
        ? { $ref: `${STD_BASE}${pt.value.slice(4)}.json` }
        : { $ref: `#/$defs/${pt.value}` }
    case 'array':
      return { type: 'array', items: propertyTypeToSchema(pt.value) }
    case 'enum':
      return { type: 'string', enum: pt.value }
  }
}

function typeDefinitionToSchema(td: TypeDefinition): object {
  const required = td.properties.filter(p => !p.is_optional).map(p => p.name)
  const properties: Record<string, object> = {}
  for (const p of td.properties) {
    properties[p.name] = {
      ...propertyTypeToSchema(p.type),
      ...(p.description ? { description: p.description } : {}),
    }
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    'x-category': td.category.uri,
    ...(td.category.label ? { 'x-category-label': td.category.label } : {}),
    ...(td.concept ? { 'x-concept': td.concept.uri } : {}),
    ...(td.concept?.label ? { 'x-concept-label': td.concept.label } : {}),
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  }
}

function refFromAnnotatedRef(ref: AnnotatedRef): object {
  return ref.name.startsWith('std.')
    ? { $ref: `${STD_BASE}${ref.name.slice(4)}.json` }
    : { $ref: `#/$defs/${ref.name}` }
}

/** Returns JSON Schema 2020-12 string for types.json, or null if nothing to write. */
export function buildTypesJson(df: DescriptionFile): string | null {
  if (df.types.length === 0 && df.input.length === 0 && df.output.length === 0) return null

  const defs: Record<string, object> = {}
  for (const td of df.types) {
    defs[td.name] = typeDefinitionToSchema(td)
  }

  return JSON.stringify(
    {
      ...(df.input.length ? { input: df.input.map(refFromAnnotatedRef) } : {}),
      ...(df.output.length ? { output: df.output.map(refFromAnnotatedRef) } : {}),
      ...(Object.keys(defs).length ? { $defs: defs } : {}),
    },
    null,
    2
  )
}

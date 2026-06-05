#!/usr/bin/env sh

# Ensure Apache 2.0 license headers on all .ts files

HEADER='// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.'

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "./dist/*" \
  ! -path "./node_modules/*" \
  ! -path "./.git/*" \
  | while read -r file; do

  # Check if file already has the license header
  if ! head -20 "$file" | grep -q "Licensed under the Apache License"; then
    # Check if file starts with shebang
    if head -1 "$file" | grep -q "^#!"; then
      # Extract shebang and rest of file
      shebang=$(head -1 "$file")
      rest=$(tail -n +2 "$file")

      # Write back with header after shebang
      {
        echo "$shebang"
        echo ""
        echo "$HEADER"
        echo ""
        echo "$rest"
      } > "$file"
    else
      # No shebang, prepend header
      {
        echo "$HEADER"
        echo ""
        cat "$file"
      } > "$file.tmp"
      mv "$file.tmp" "$file"
    fi

    # Stage the modified file
    git add "$file"
  fi
done

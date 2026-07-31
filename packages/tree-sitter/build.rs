// Copyright 2026 Danilo Borges
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
// limitations under the License.

fn main() {
    let description_src = std::path::Path::new("tree-sitter-description/src");
    cc::Build::new()
        .include(description_src)
        .file(description_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-description-parser");

    let behavior_src = std::path::Path::new("tree-sitter-behavior/src");
    cc::Build::new()
        .include(&behavior_src)
        .file(behavior_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-behavior-parser");
}

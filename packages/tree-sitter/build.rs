fn main() {
    let description_src = std::path::Path::new("tree-sitter-description/src");
    cc::Build::new()
        .include(description_src)
        .file(description_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-description-parser");

    cc::Build::new()
        .include(description_src)
        .file(description_src.join("scanner.c"))
        .warnings(false)
        .compile("tree-sitter-description-scanner");

    let behavior_src = std::path::Path::new("tree-sitter-behavior/src");
    cc::Build::new()
        .include(&behavior_src)
        .file(behavior_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-behavior-parser");
}

fn main() {
    let agent_src = std::path::Path::new("src");
    cc::Build::new()
        .include(agent_src)
        .file(agent_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-agent-parser");

    cc::Build::new()
        .include(agent_src)
        .file(agent_src.join("scanner.c"))
        .warnings(false)
        .compile("tree-sitter-agent-scanner");

    let behavior_src = std::path::Path::new("behavior").join("src");
    cc::Build::new()
        .include(&behavior_src)
        .file(behavior_src.join("parser.c"))
        .warnings(false)
        .compile("tree-sitter-behavior-parser");

    cc::Build::new()
        .include(&behavior_src)
        .file(behavior_src.join("scanner.c"))
        .warnings(false)
        .compile("tree-sitter-behavior-scanner");
}

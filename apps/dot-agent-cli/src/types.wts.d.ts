declare module 'web-tree-sitter' {
  export class Parser {
    static init(): Promise<void>
    static Language: {
      load(path: string): Promise<any>
    }
    setLanguage(lang: any): void
    parse(text: string): any
  }
}

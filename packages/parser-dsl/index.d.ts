export function init(): Promise<void>;
export function parse(text: string): string;
export function get_graph(text: string): string;
export function get_states(text: string): string;
export function get_intents_for_state(text: string, state_name: string): string;
export default init;

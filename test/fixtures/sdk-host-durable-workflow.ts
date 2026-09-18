import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { workflow } from "@bastani/atomic/workflows";
import { Type } from "typebox";

// #3105: identical source and gate policy in both persisted handoff directions.
export default workflow({
	name: "sdk-host-durable",
	description: "Persisted host handoff",
	inputs: {},
	outputs: { text: Type.String(), approved: Type.Boolean() },
	run: async (ctx) => {
		const text = await ctx.ui.input("  durable raw text  ");
		await ctx.tool("completed-receipt", {}, async () => {
			appendFileSync(join(process.env.ATOMIC_FAULT_TEST_HOME!, "receipts.jsonl"), JSON.stringify({ text }) + "\n");
			return text;
		});
		const approved = await ctx.ui.confirm("Explicit durable approval");
		if (approved) {
			await ctx.tool("guarded-effect", {}, async () => {
				appendFileSync(join(process.env.ATOMIC_FAULT_TEST_HOME!, "effects.jsonl"), JSON.stringify({ text }) + "\n");
				return true;
			});
		}
		return { text, approved };
	},
});

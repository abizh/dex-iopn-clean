import { solveRoute } from "../lib/solver.js";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokenIn, tokenOut, amount } = req.body;

    const result = solveRoute({
      tokenIn,
      tokenOut,
      amount: Number(amount)
    });

    if (!result) {
      return res.status(404).json({ error: "No route found" });
    }

    return res.status(200).json({
      route: result.path.map(step => ({
        pool: `${step.from}/${step.to}`
      })),
      expectedOut: result.out,
      score: result.score,
      gasEstimate: result.path.length * 120000
    });

  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}

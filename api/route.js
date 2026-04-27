import { solveRoute } from "../lib/solver.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tokenIn, tokenOut, amount } = req.body;

  const result = solveRoute(tokenIn, tokenOut, amount);

  return res.status(200).json(result);
}

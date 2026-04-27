import { solveRoute } from "../lib/solver.js";

export default function handler(req, res) {
  const { tokenIn, tokenOut, amount } = req.body;
  const result = solveRoute(tokenIn, tokenOut, amount);
  res.status(200).json(result);
}

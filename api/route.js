export default async function handler(req, res) {

  // hanya terima POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokenIn, tokenOut, amount } = req.body;

    // VALIDASI INPUT
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 🔥 MOCK ROUTE (sementara, nanti diganti engine real)
    const route = [
      { pool: "OPN/WOPN" },
      { pool: "WOPN/OPNT" }
    ];

    const expectedOut = Number(amount) * 0.248461;
    const score = 92.4;
    const gasEstimate = 240000;

    return res.status(200).json({
      route,
      expectedOut,
      score,
      gasEstimate
    });

  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}

async function runOptimizer() {
  const amount = parseFloat(document.getElementById("amountIn").value);

  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tokenIn: "OPN",
        tokenOut: "OPNT",
        amount
      })
    });

    const data = await res.json();

    // ===== GUARD DISPLAY =====
    const routeText = data.route && data.route.length
      ? data.route.join(" → ")
      : "NO ROUTE";

    const outputText = data.expectedOut ?? 0;

    document.getElementById("result").innerHTML = `
      <b>Route:</b> ${routeText}<br>
      <b>Output:</b> ${outputText}
    `;

  } catch (err) {
    document.getElementById("result").innerHTML = `
      <span style="color:red;">API ERROR</span>
    `;
  }
}

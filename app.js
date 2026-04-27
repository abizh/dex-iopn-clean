async function runOptimizer() {
  const amount = parseFloat(document.getElementById("amountIn").value);

  const res = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenIn: "OPN",
      tokenOut: "OPNT",
      amount
    })
  });

  const data = await res.json();

  document.getElementById("result").innerHTML = `
    <b>Route:</b> ${data.route.join(" → ")}<br>
    <b>Output:</b> ${data.expectedOut}
  `;
}

async function runOptimizer() {
  try {
    const amount = parseFloat(document.getElementById("amountIn").value);

    const res = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tokenIn: "OPN",
        tokenOut: "OPNT",
        amount: amount
      })
    });

    const data = await res.json();

    console.log("API RESULT:", data); // debug

    // ===== VALIDASI =====
    if (!data.route) {
      document.getElementById("route").innerText = "NO ROUTE";
      document.getElementById("output").innerText = "0";
      return;
    }

    document.getElementById("route").innerText =
      data.route.join(" → ");

    document.getElementById("output").innerText =
      data.expectedOut;

  } catch (err) {
    console.error(err);

    document.getElementById("route").innerText = "ERROR";
    document.getElementById("output").innerText = "CHECK CONSOLE";
  }
}

const form = document.querySelector("#form");
const input = document.querySelector("#url");
const button = document.querySelector("#submit");
const result = document.querySelector("#result");

function safeLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = url;
  return a;
}
function showError(message) {
  result.hidden = false;
  result.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Tidak dapat memproses link";
  const p = document.createElement("p");
  p.textContent = message;
  result.append(h, p);
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = false;
  result.textContent = "Memeriksa URL…";
  button.disabled = true;
  button.textContent = "Memeriksa…";
  try {
    const response = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.value.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    result.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = data.provider ? `${data.provider} terdeteksi` : "Hasil pemeriksaan";
    const badge = document.createElement("span");
    badge.className = "status";
    badge.textContent = data.status;
    const p = document.createElement("p");
    p.textContent = data.message;
    result.append(h, badge, p);

    if (data.finalUrl) {
      const p2 = document.createElement("p");
      p2.append("URL hasil: ", safeLink(data.finalUrl));
      result.append(p2);
      const open = document.createElement("p");
      const link = safeLink(data.finalUrl);
      link.textContent = "Buka URL hasil (periksa dahulu)";
      open.append(link);
      result.append(open);
    }
    if (data.chain?.length) {
      const label = document.createElement("p");
      label.textContent = "Rantai pengalihan:";
      const list = document.createElement("ul");
      for (const item of data.chain) {
        const li = document.createElement("li");
        li.append(safeLink(item));
        list.append(li);
      }
      result.append(label, list);
    }
    if (data.provider) {
      const openP = document.createElement("p");
      const original = safeLink(data.input);
      original.textContent = "Buka link asli";
      openP.append(original);
      result.append(openP);
    }
  } catch (err) {
    showError(err.message || "Terjadi kesalahan.");
  } finally {
    button.disabled = false;
    button.innerHTML = 'Periksa Link <span>→</span>';
  }
});

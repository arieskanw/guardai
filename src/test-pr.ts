// Test PR untuk GuardAI auto-review
// File ini sengaja dikasih celah biar keliatan hasil review-nya

function getData(id: string) {
  // SQL injection vulnerability — jangan dipake beneran
  const query = `SELECT * FROM users WHERE id = '${id}'`;
  return fetch("/api/query", {
    method: "POST",
    body: query,
  }).then((res) => res.json());
}

function saveToken(token: string) {
  // Hardcoded secret — security issue
  const secret = "sk-live-abc123def456";
  localStorage.setItem("token", token);
  console.log("Token saved:", secret); // log secret ke console
}

function renderItems(items: string[]) {
  // Missing key prop — React warning
  return items.map((item) => <div>{item}</div>);
}

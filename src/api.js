export const API_URL = "http://localhost:4000/api";

export async function register(username, password) {
    return fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    }).then(res => res.json());
}

export async function login(username, password) {
    return fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    }).then(res => res.json());
}

export async function fetchGraph(token) {
    return fetch(`${API_URL}/graph`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());
}

export async function saveGraph(token, nodes, links) {
    return fetch(`${API_URL}/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nodes, links }),
    }).then(res => res.json());
}

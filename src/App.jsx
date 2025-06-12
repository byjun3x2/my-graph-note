import React, { useState, useEffect } from "react";
import GraphView from "./GraphView";
import { register, login, fetchGraph, saveGraph } from "./api";

function App() {
    const [auth, setAuth] = useState(() => {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        const userId = localStorage.getItem("userId");
        return token ? { token, username, userId } : null;
    });
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(false);

    // 최초 데이터 fetch 완료 여부
    const [hasLoaded, setHasLoaded] = useState(false);

    // 로그인/회원가입 폼 상태
    const [form, setForm] = useState({ username: "", password: "" });
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState("");

    // 로그인 후 노드+링크 불러오기 (항상 userId로만!)
    useEffect(() => {
        if (auth) {
            setLoading(true);
            fetchGraph(auth.token)
                .then(data => {
                    setNodes(data.nodes || []);
                    setLinks(data.links || []);
                    setHasLoaded(true); // 최초 fetch 후 true
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                    setHasLoaded(false);
                });
        } else {
            setNodes([]);
            setLinks([]);
            setHasLoaded(false);
        }
    }, [auth]);

    // nodes/links가 바뀔 때마다 서버에 저장 (최초 fetch 후에만 저장)
    useEffect(() => {
        if (auth && hasLoaded) {
            const linksToSave = links.map(l => ({
                source: typeof l.source === "object" ? l.source.id : l.source,
                target: typeof l.target === "object" ? l.target.id : l.target,
                userId: auth.userId // 반드시 포함!
            }));
            const nodesToSave = nodes.map(n => ({ ...n, userId: auth.userId })); // userId 포함!
            saveGraph(auth.token, nodesToSave, linksToSave);
        }
        // eslint-disable-next-line
    }, [nodes, links]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError("");
        try {
            if (isLogin) {
                const res = await login(form.username, form.password);
                if (res.token) {
                    setAuth(res);
                    localStorage.setItem("token", res.token);
                    localStorage.setItem("username", res.username);
                    localStorage.setItem("userId", res.userId);
                } else {
                    setError(res.message || "로그인 실패");
                }
            } else {
                const res = await register(form.username, form.password);
                if (res.message) {
                    setIsLogin(true);
                } else {
                    setError(res.message || "회원가입 실패");
                }
            }
        } catch (e) {
            setError("네트워크 오류");
        }
    };

    const handleLogout = () => {
        setAuth(null);
        setNodes([]);
        setLinks([]);
        setHasLoaded(false);
        localStorage.clear();
        // 서버에는 삭제 요청을 보내지 않는다!
    };

    if (!auth) {
        return (
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                maxWidth: 320,
                width: "90vw",
                background: "#fff",
                padding: 32,
                borderRadius: 12,
                boxShadow: "0 4px 24px #0001",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxSizing: "border-box",
                zIndex: 1000
            }}>
                <h2 style={{
                    textAlign: "center",
                    color: "#1976d2",
                    fontWeight: 700,
                    marginBottom: 24
                }}>
                    {isLogin ? "로그인" : "회원가입"}
                </h2>
                <form onSubmit={handleAuth} style={{ width: "100%" }}>
                    <input
                        type="text"
                        placeholder="아이디"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        style={{ width: "100%", marginBottom: 10, padding: 8, boxSizing: "border-box" }}
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        style={{ width: "100%", marginBottom: 10, padding: 8, boxSizing: "border-box" }}
                    />
                    <button type="submit" style={{
                        width: "100%", padding: 10, background: "#1976d2",
                        color: "#fff", border: "none", borderRadius: 6, fontSize: 16
                    }}>
                        {isLogin ? "로그인" : "회원가입"}
                    </button>
                </form>
                <div style={{ marginTop: 12, textAlign: "center" }}>
                    <button onClick={() => setIsLogin(!isLogin)} style={{
                        background: "none", border: "none", color: "#1976d2",
                        cursor: "pointer", fontSize: 14
                    }}>
                        {isLogin ? "회원가입" : "로그인"}으로 전환
                    </button>
                </div>
                {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
            </div>
        );
    }

    return (
        <>
            <div style={{
                position: "fixed", top: 18, left: 32, zIndex: 1000,
                background: "rgba(255,255,255,0.92)", padding: "7px 20px",
                borderRadius: 8, boxShadow: "0 2px 10px #0001", fontSize: 15
            }}>
                <span style={{ color: "#1976d2", fontWeight: 600 }}>{auth.username}</span> 님
                <button onClick={handleLogout} style={{
                    marginLeft: 12, background: "#eee", border: "none", borderRadius: 6,
                    padding: "4px 12px", cursor: "pointer", fontSize: 14
                }}>
                    로그아웃
                </button>
            </div>
            <GraphView
                nodes={nodes}
                setNodes={setNodes}
                links={links}
                setLinks={setLinks}
                loading={loading}
                userId={auth.userId}
            />
        </>
    );
}

export default App;

"use client";

import { useEffect, useMemo, useState } from "react";
import Studio from "../../components/Studio";
import { listOrders } from "../../lib/orders";
import type { Order } from "../../lib/order";

export default function StudioPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  const validEmail = process.env.NEXT_PUBLIC_STUDIO_EMAIL || "admin@mogifiedmoments.com";
  const validPassword = process.env.NEXT_PUBLIC_STUDIO_PASSWORD || "admin123";

  useEffect(() => {
    const session = localStorage.getItem("mm_studio_auth");
    if (session === "true") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    async function fetchInitialOrders() {
      try {
        const fetched = await listOrders();
        setOrders(fetched);
      } catch (err) {
        console.error("Failed to load orders on studio page:", err);
      }
    }
    fetchInitialOrders();
  }, []);

  const regularOrders = useMemo(
    () => orders.filter((o) => !o.packageId && o.fulfillmentType !== "delivery"),
    [orders]
  );
  const partyOrders = useMemo(
    () => orders.filter((o) => Boolean(o.packageId)),
    [orders]
  );

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      email.trim().toLowerCase() === validEmail.toLowerCase() &&
      password === validPassword
    ) {
      localStorage.setItem("mm_studio_auth", "true");
      setIsAuthenticated(true);
    } else {
      setError("Invalid email address or password.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("mm_studio_auth");
    setIsAuthenticated(false);
    setEmail("");
    setPassword("");
  }

  if (isAuthenticated === null) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <main className="studio-login-screen">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.png" alt="Mogified Moments" className="login-logo" />
            <h2>Studio Access</h2>
            <p>Authorized staff and management only</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              <span>Email Address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mogifiedmoments.com"
                autoComplete="email"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-button">
              Unlock Dashboard →
            </button>
          </form>
        </div>

        <style jsx>{`
          .studio-login-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1e1b2e 0%, #0f0c1b 100%);
            padding: 20px;
            font-family: Nunito, sans-serif;
            color: #292342;
          }
          .login-card {
            background: #ffffff;
            width: 100%;
            max-width: 420px;
            border-radius: 28px;
            padding: 36px 30px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
          }
          .login-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .login-logo {
            width: 80px;
            height: auto;
            margin-bottom: 12px;
          }
          .login-header h2 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            color: #1e1b2e;
          }
          .login-header p {
            margin: 4px 0 0;
            color: #756f87;
            font-size: 13px;
          }
          .login-form {
            display: grid;
            gap: 16px;
          }
          .login-form label span {
            display: block;
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 6px;
            color: #292342;
          }
          .login-form input {
            width: 100%;
            padding: 13px 16px;
            border: 2px solid #ecdff5;
            border-radius: 14px;
            outline: none;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.2s;
          }
          .login-form input:focus {
            border-color: #7048d8;
          }
          .login-error {
            background: #fff0f4;
            border: 1px solid #ffd3e1;
            color: #c52b67;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            text-align: center;
          }
          .login-button {
            background: linear-gradient(135deg, #ec3e82, #7048d8);
            color: #fff;
            border: none;
            padding: 14px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            margin-top: 4px;
            box-shadow: 0 10px 20px rgba(236, 62, 130, 0.25);
          }
          .login-button:active {
            transform: scale(0.98);
          }
        `}</style>
      </main>
    );
  }

  return <Studio onLogout={handleLogout} />;
}
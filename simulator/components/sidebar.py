"""
components/sidebar.py
Renders the left sidebar: connection settings + login/register/logout + model status + system stats.
"""
import streamlit as st
import requests
import psutil
import torch
from components.session import get_api_url, get_ws_url
from components.websocket_manager import connect_ws, disconnect_ws


def render_sidebar(posture_model=None, object_model=None, cry_model=None) -> None:
    with st.sidebar:
        st.image("assets/logo.png", use_container_width=True) if _logo_exists() else st.markdown("## 👶 Smart Cradle")
        st.divider()

        # ── System Stats ──────────────────────────────────────────────────────
        with st.expander("📊 System Stats", expanded=True):
            _render_system_stats()

        # ── Model Status ──────────────────────────────────────────────────────
        with st.expander("🤖 Model Status", expanded=True):
            _render_model_status("Posture Detection", posture_model)
            _render_model_status("Object Detection",  object_model)
            _render_model_status("Cry Detection",     cry_model)

        st.divider()

        # ── Connection Settings ───────────────────────────────────────────────
        with st.expander("⚙️ Connection Settings", expanded=False):
            st.session_state.db_url = st.text_input(
                "Database URL", value=st.session_state.db_url, key="sb_db_url"
            )
            st.session_state.backend_base = st.text_input(
                "Backend Base URL", value=st.session_state.backend_base, key="sb_backend"
            )
            st.session_state.sim_token = st.text_input(
                "Simulator Token",
                value=st.session_state.sim_token,
                type="password",
                key="sb_token",
            )
            st.caption(f"API: `{get_api_url()}`")
            st.caption(f"WS:  `{get_ws_url()}`")

        st.divider()

        # ── Auth ──────────────────────────────────────────────────────────────
        st.subheader("🔐 Authentication")
        if not st.session_state.cookies:
            _render_login()
            st.divider()
            _render_register()
        else:
            st.success(f"Logged in as **{st.session_state.username}**")
            if st.button("Logout", use_container_width=True):
                _do_logout()


# ── Private helpers ───────────────────────────────────────────────────────────

def _render_system_stats() -> None:
    """Display CPU, RAM, and GPU usage bars."""
    cpu_pct = psutil.cpu_percent(interval=0.2)
    ram     = psutil.virtual_memory()
    ram_pct = ram.percent
    ram_used_gb = ram.used / (1024 ** 3)
    ram_total_gb = ram.total / (1024 ** 3)

    # CPU
    cpu_color = "normal" if cpu_pct < 70 else ("off" if cpu_pct < 90 else "inverse")
    st.caption("🖥️ CPU")
    st.progress(int(cpu_pct), text=f"{cpu_pct:.0f}%")

    # RAM
    st.caption(f"🧠 RAM  {ram_used_gb:.1f} / {ram_total_gb:.1f} GB")
    st.progress(int(ram_pct), text=f"{ram_pct:.0f}%")

    # GPU (if available)
    if torch.cuda.is_available():
        try:
            gpu_mem_used  = torch.cuda.memory_allocated() / (1024 ** 3)
            gpu_mem_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            gpu_pct = int((gpu_mem_used / gpu_mem_total) * 100)
            gpu_name = torch.cuda.get_device_properties(0).name
            st.caption(f"⚡ GPU  {gpu_mem_used:.1f} / {gpu_mem_total:.1f} GB  ({gpu_name})")
            st.progress(gpu_pct, text=f"{gpu_pct}%")
        except Exception:
            st.caption("⚡ GPU — unavailable")
    else:
        st.caption("⚡ GPU — not available (CPU mode)")


def _render_model_status(name: str, model) -> None:
    """Show a green/red pill for each model."""
    if model is not None:
        st.markdown(f"🟢 **{name}** — loaded")
    else:
        st.markdown(f"🔴 **{name}** — loading…")


def _logo_exists() -> bool:
    import os
    return os.path.exists("assets/logo.png")


def _render_login() -> None:
    st.markdown("**Login**")
    username = st.text_input("Username", key="login_user")
    password = st.text_input("Password", type="password", key="login_pass")
    if st.button("Login", use_container_width=True, key="btn_login"):
        _do_login(username, password)


def _render_register() -> None:
    with st.expander("📝 Create Account"):
        reg_name     = st.text_input("Full Name",         key="reg_name")
        reg_email    = st.text_input("Email",             key="reg_email")
        reg_username = st.text_input("Username",          key="reg_user")
        reg_password = st.text_input("Password", type="password", key="reg_pass")
        reg_address  = st.text_input("Address (optional)", key="reg_addr")
        reg_phone    = st.text_input("Phone (optional)",   key="reg_phone")
        if st.button("Create Account", use_container_width=True, key="btn_register"):
            _do_register(reg_name, reg_email, reg_username, reg_password, reg_address, reg_phone)


def _do_login(username: str, password: str) -> None:
    try:
        resp = requests.post(
            f"{get_api_url()}/login",
            json={"username": username, "password": password},
        )
        if resp.status_code == 200:
            st.session_state.cookies = resp.cookies
            st.session_state.username = username
            connect_ws()
            st.success(f"Logged in as {username}")
            st.rerun()
        else:
            st.error("Login failed. Check your credentials.")
    except Exception as exc:
        st.error(f"Connection error: {exc}")


def _do_register(name, email, username, password, address, phone) -> None:
    payload = {
        "name": name, "email": email, "username": username,
        "password": password, "address": address or None, "phone": phone or None,
    }
    try:
        resp = requests.post(f"{get_api_url()}/register", json=payload)
        if resp.status_code in (200, 201):
            st.session_state.cookies = resp.cookies
            st.session_state.username = username
            connect_ws()
            st.success(f"Registered and logged in as {username}")
            st.rerun()
        else:
            st.error(resp.text or "Registration failed.")
    except Exception as exc:
        st.error(f"Registration error: {exc}")


def _do_logout() -> None:
    st.session_state.cookies  = None
    st.session_state.username = None
    disconnect_ws()
    st.rerun()

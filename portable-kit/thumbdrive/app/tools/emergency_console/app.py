from __future__ import annotations

import requests
import streamlit as st


st.set_page_config(
    page_title="Offline Emergency Information Repository",
    page_icon="SOS",
    layout="wide",
)

st.markdown(
    """
    <style>
    :root {
        --bg: #000000;
        --text: #FFFFFF;
        --muted: #9CA3AF;
        --panel: #0A0A0A;
        --border: #1F2937;
        --accent: #3B82F6;
        --ok: #10B981;
        --warn: #F59E0B;
        --err: #EF4444;
    }

    .stApp {
        background-color: var(--bg);
        color: var(--text);
    }

    section[data-testid="stSidebar"] {
        background-color: var(--panel);
        border-right: 1px solid var(--border);
    }

    .block-container {
        padding-top: 1rem;
        padding-bottom: 1rem;
    }

    h1, h2, h3, h4, h5, h6, p, label, div, span {
        color: var(--text) !important;
    }

    .muted {
        color: var(--muted) !important;
        font-size: 0.9rem;
    }

    .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 10px;
    }

    .article-box {
        background: #050505;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 14px;
        min-height: 280px;
        max-height: 60vh;
        overflow-y: auto;
        white-space: pre-wrap;
    }

    div[data-testid="stChatMessage"] {
        background: #050505;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px;
    }

    .status-pill {
        display: inline-block;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 2px 10px;
        font-size: 0.8rem;
        color: var(--muted);
        margin-right: 6px;
    }

    .stButton > button {
        width: 100%;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #101010;
        color: var(--text);
    }

    .stButton > button:hover {
        border-color: var(--accent);
        color: var(--text);
    }

    .stTextInput > div > div > input {
        background-color: #080808;
        color: var(--text);
        border: 1px solid var(--border);
    }

    .stChatInputContainer {
        border-top: 1px solid var(--border);
    }

    @media (max-width: 900px) {
        .block-container {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("Offline Emergency Information Repository")
st.markdown(
    '<div class="muted">Local-first intelligence over LAN-connected Kiwix and Ollama infrastructure.</div>',
    unsafe_allow_html=True,
)

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

if "current_article_title" not in st.session_state:
    st.session_state.current_article_title = ""

if "current_article_text" not in st.session_state:
    st.session_state.current_article_text = ""

if "ai_context" not in st.session_state:
    st.session_state.ai_context = ""

if "last_search_term" not in st.session_state:
    st.session_state.last_search_term = ""

if "auto_index_article" not in st.session_state:
    st.session_state.auto_index_article = True

if "index_status" not in st.session_state:
    st.session_state.index_status = ""

if "retrieval_source_filter" not in st.session_state:
    st.session_state.retrieval_source_filter = ["kiwix", "manual", "file", "legacy"]


with st.expander("Network Infrastructure Settings", expanded=False):
    c1, c2 = st.columns(2)
    with c1:
        sovereign_api_server = st.text_input(
            "Sovereign API IP/Port",
            value=st.session_state.get("sovereign_api_server", "http://127.0.0.1:8000"),
            help="Optional orchestration path. Example: http://192.168.1.50:8000",
        )
        ollama_server = st.text_input(
            "Ollama Server IP/Port",
            value=st.session_state.get("ollama_server", "http://127.0.0.1:11434"),
            help="Example: http://192.168.1.50:11434",
        )
        ollama_model = st.text_input(
            "Ollama Model Name",
            value=st.session_state.get("ollama_model", "llama3.2"),
            help="Example: llama3.2, mistral, qwen2.5",
        )
    with c2:
        kiwix_server = st.text_input(
            "Kiwix Server IP/Port",
            value=st.session_state.get("kiwix_server", "http://127.0.0.1:8000"),
            help="Example: http://192.168.1.60:8000",
        )
        assistant_mode = st.selectbox(
            "Assistant Mode (Sovereign API)",
            options=["re-genesis", "aetherium", "amaterasu", "powercoder-z"],
            index=0,
        )
        use_sovereign_api = st.checkbox(
            "Route AI requests through Sovereign API",
            value=st.session_state.get("use_sovereign_api", True),
            help="When enabled, Streamlit sends requests to /api/chat on the local FastAPI orchestrator.",
        )
        auto_index_article = st.checkbox(
            "Auto-index loaded Kiwix article into Sovereign retrieval",
            value=st.session_state.get("auto_index_article", True),
            help="When enabled, loaded article text is added to backend retrieval context.",
        )
        retrieval_source_filter = st.multiselect(
            "Retrieval source filter (Sovereign API)",
            options=["kiwix", "manual", "file", "legacy"],
            default=st.session_state.get("retrieval_source_filter", ["kiwix", "manual", "file", "legacy"]),
            help="Choose which indexed source types the retrieval layer may use during chat.",
        )

    st.session_state.sovereign_api_server = sovereign_api_server.strip().rstrip("/")
    st.session_state.ollama_server = ollama_server.strip().rstrip("/")
    st.session_state.ollama_model = ollama_model.strip()
    st.session_state.kiwix_server = kiwix_server.strip().rstrip("/")
    st.session_state.assistant_mode = assistant_mode
    st.session_state.use_sovereign_api = use_sovereign_api
    st.session_state.auto_index_article = auto_index_article
    st.session_state.retrieval_source_filter = retrieval_source_filter


def _extract_text_from_kiwix_payload(search_term: str, data: object) -> tuple[str, str]:
    title = search_term
    text = ""

    if isinstance(data, dict):
        if "title" in data and "content" in data:
            title = str(data.get("title", search_term))
            text = str(data.get("content", ""))
        elif "results" in data and isinstance(data.get("results"), list) and data.get("results"):
            first = data["results"][0]
            if isinstance(first, dict):
                title = str(first.get("title", search_term))
                text = str(first.get("content") or first.get("snippet") or "")
        elif "text" in data:
            title = str(data.get("title", search_term))
            text = str(data.get("text", ""))

    if not text:
        text = str(data)

    return title, text


def query_kiwix(search_term: str, server_url: str) -> dict:
    if not search_term.strip():
        return {"ok": False, "title": "", "text": "", "raw": None, "error": "Please enter a search term."}

    endpoints = [
        (f"{server_url}/search", {"q": search_term, "format": "json"}),
        (f"{server_url}/search", {"pattern": search_term}),
        (f"{server_url}/api/search", {"q": search_term}),
    ]

    errors: list[str] = []

    for url, params in endpoints:
        try:
            response = requests.get(url, params=params, timeout=12)
            response.raise_for_status()
            data = response.json()
            title, text = _extract_text_from_kiwix_payload(search_term, data)
            return {"ok": True, "title": title, "text": text, "raw": data, "error": ""}
        except requests.exceptions.Timeout:
            errors.append(f"Timeout on {url}")
        except requests.exceptions.ConnectionError:
            errors.append(f"Connection error on {url}")
        except requests.exceptions.HTTPError as exc:
            errors.append(f"HTTP error on {url}: {exc}")
        except ValueError:
            errors.append(f"Non-JSON response on {url}")
        except Exception as exc:
            errors.append(f"Unexpected error on {url}: {exc}")

    return {
        "ok": False,
        "title": "",
        "text": "",
        "raw": None,
        "error": "Unable to query Kiwix. Checked multiple endpoint patterns. Details: " + " | ".join(errors[:3]),
    }


def query_ollama(prompt: str, context: str, server_url: str, model: str) -> dict:
    url = f"{server_url}/api/generate"

    if context.strip():
        full_prompt = (
            "You are an emergency information AI advisor. Use the provided context first when answering. "
            "Prioritize practical and low-resource field instructions.\n\n"
            f"CONTEXT:\n{context}\n\n"
            f"USER QUESTION:\n{prompt}\n\n"
            "If context is insufficient, state what is missing and provide a safe fallback."
        )
    else:
        full_prompt = prompt

    payload = {"model": model, "prompt": full_prompt, "stream": False}

    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        answer = str(data.get("response", "")).strip() or "No response content received from Ollama."
        return {"ok": True, "response": answer, "error": ""}
    except requests.exceptions.Timeout:
        return {"ok": False, "response": "", "error": "Ollama request timed out."}
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "response": "",
            "error": "Could not connect to Ollama server. Verify IP/port and LAN availability.",
        }
    except requests.exceptions.HTTPError as exc:
        return {"ok": False, "response": "", "error": f"Ollama HTTP error: {exc}"}
    except Exception as exc:
        return {"ok": False, "response": "", "error": f"Unexpected Ollama error: {exc}"}


def query_sovereign_api(prompt: str, context: str, server_url: str, assistant_id: str) -> dict:
    url = f"{server_url}/api/chat"

    message = prompt
    if context.strip():
        message = (
            "Use this emergency context first. If information is missing, say what is missing and provide a safe fallback.\n\n"
            f"CONTEXT:\n{context}\n\n"
            f"QUESTION:\n{prompt}"
        )

    payload = {
        "assistant_id": assistant_id,
        "message": message,
        "history": st.session_state.get("chat_history", []),
        "use_retrieval": True,
        "max_context_chunks": 6,
        "retrieval_source_types": st.session_state.get("retrieval_source_filter", []),
    }

    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        answer = str(data.get("response", "")).strip() or "No response content received from Sovereign API."
        return {"ok": True, "response": answer, "error": ""}
    except requests.exceptions.Timeout:
        return {"ok": False, "response": "", "error": "Sovereign API request timed out."}
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "response": "",
            "error": "Could not connect to Sovereign API server. Verify IP/port and LAN availability.",
        }
    except requests.exceptions.HTTPError as exc:
        return {"ok": False, "response": "", "error": f"Sovereign API HTTP error: {exc}"}
    except Exception as exc:
        return {"ok": False, "response": "", "error": f"Unexpected Sovereign API error: {exc}"}


def index_document_into_sovereign(title: str, content: str, server_url: str) -> dict:
    url = f"{server_url}/api/index/document"
    payload = {
        "title": title,
        "content": content,
        "source_type": "kiwix",
        "source_id": f"{st.session_state.get('kiwix_server', '')}|{title}",
    }

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        chunks = int(data.get("chunks_added", 0))
        deduplicated = bool(data.get("deduplicated", False))
        total_chunks = int(data.get("total_chunks", 0))
        return {
            "ok": True,
            "chunks": chunks,
            "deduplicated": deduplicated,
            "total_chunks": total_chunks,
            "error": "",
        }
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": "Sovereign indexing request timed out.",
        }
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": "Could not connect to Sovereign API server for indexing.",
        }
    except requests.exceptions.HTTPError as exc:
        return {
            "ok": False,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": f"Sovereign indexing HTTP error: {exc}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": f"Unexpected Sovereign indexing error: {exc}",
        }


def upload_file_into_sovereign(file_name: str, file_bytes: bytes, server_url: str) -> dict:
    url = f"{server_url}/api/index/upload"
    files = {"file": (file_name, file_bytes)}
    data = {
        "source_type": "upload",
        "source_id": file_name,
        "title": file_name,
    }

    try:
        response = requests.post(url, files=files, data=data, timeout=90)
        response.raise_for_status()
        payload = response.json()
        return {
            "ok": True,
            "parsed_type": payload.get("parsed_type", "unknown"),
            "parsed_chars": int(payload.get("parsed_chars", 0)),
            "chunks": int(payload.get("chunks_added", 0)),
            "deduplicated": bool(payload.get("deduplicated", False)),
            "total_chunks": int(payload.get("total_chunks", 0)),
            "error": "",
        }
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "parsed_type": "",
            "parsed_chars": 0,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": "Upload indexing request timed out.",
        }
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "parsed_type": "",
            "parsed_chars": 0,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": "Could not connect to Sovereign API server for upload ingestion.",
        }
    except requests.exceptions.HTTPError as exc:
        return {
            "ok": False,
            "parsed_type": "",
            "parsed_chars": 0,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": f"Upload ingestion HTTP error: {exc}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "parsed_type": "",
            "parsed_chars": 0,
            "chunks": 0,
            "deduplicated": False,
            "total_chunks": 0,
            "error": f"Unexpected upload ingestion error: {exc}",
        }


left_col, right_col = st.columns([1, 1], gap="large")

with left_col:
    st.subheader("Knowledge Base (Kiwix)")

    uploaded = st.file_uploader(
        "Upload PDF/DOCX/CSV for Amaterasu workflows",
        type=["pdf", "docx", "csv"],
        accept_multiple_files=False,
    )

    if uploaded is not None:
        if st.button("Ingest Uploaded File", key="ingest_uploaded_file"):
            result_upload = upload_file_into_sovereign(
                file_name=uploaded.name,
                file_bytes=uploaded.getvalue(),
                server_url=st.session_state.sovereign_api_server,
            )
            if result_upload["ok"]:
                if result_upload["deduplicated"]:
                    st.info(
                        "Uploaded file already indexed earlier; duplicate skipped. "
                        f"Parsed as {result_upload['parsed_type']} with {result_upload['parsed_chars']} chars."
                    )
                else:
                    st.success(
                        f"Uploaded file ingested ({result_upload['chunks']} chunks). "
                        f"Parsed as {result_upload['parsed_type']} with {result_upload['parsed_chars']} chars."
                    )
            else:
                st.error(result_upload["error"])

    search_term = st.text_input(
        "Search offline emergency repository",
        value=st.session_state.last_search_term,
        placeholder="e.g., CPR steps, water purification, wildfire evacuation",
        key="kiwix_search_input",
    )

    if st.button("Search Kiwix", key="search_kiwix_btn"):
        st.session_state.last_search_term = search_term
        result = query_kiwix(search_term, st.session_state.kiwix_server)
        if result["ok"]:
            st.session_state.current_article_title = result["title"]
            st.session_state.current_article_text = result["text"]
            st.session_state.index_status = ""

            if st.session_state.use_sovereign_api and st.session_state.auto_index_article:
                indexed = index_document_into_sovereign(
                    title=st.session_state.current_article_title,
                    content=st.session_state.current_article_text,
                    server_url=st.session_state.sovereign_api_server,
                )
                if indexed["ok"]:
                    if indexed["deduplicated"]:
                        st.session_state.index_status = (
                            "Already indexed earlier; skipped duplicate insertion. "
                            f"Current retrieval size: {indexed['total_chunks']} chunks."
                        )
                    else:
                        st.session_state.index_status = (
                            f"Indexed into Sovereign retrieval ({indexed['chunks']} chunks). "
                            f"Current retrieval size: {indexed['total_chunks']} chunks."
                        )
                else:
                    st.session_state.index_status = f"Indexing skipped due to error: {indexed['error']}"
        else:
            st.error(result["error"])

    if st.session_state.current_article_text:
        st.markdown(
            f"""
            <div class="card">
                <span class="status-pill">Article Loaded</span>
                <strong>{st.session_state.current_article_title}</strong>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<div class=\"article-box\">", unsafe_allow_html=True)
        st.text(st.session_state.current_article_text)
        st.markdown("</div>", unsafe_allow_html=True)

        if st.session_state.index_status:
            st.info(st.session_state.index_status)

        if st.button("Index Article into Sovereign Retrieval", key="index_article_btn"):
            indexed = index_document_into_sovereign(
                title=st.session_state.current_article_title,
                content=st.session_state.current_article_text,
                server_url=st.session_state.sovereign_api_server,
            )
            if indexed["ok"]:
                if indexed["deduplicated"]:
                    st.session_state.index_status = (
                        "Already indexed earlier; skipped duplicate insertion. "
                        f"Current retrieval size: {indexed['total_chunks']} chunks."
                    )
                    st.info(st.session_state.index_status)
                else:
                    st.session_state.index_status = (
                        f"Indexed into Sovereign retrieval ({indexed['chunks']} chunks). "
                        f"Current retrieval size: {indexed['total_chunks']} chunks."
                    )
                    st.success(st.session_state.index_status)
            else:
                st.session_state.index_status = f"Indexing error: {indexed['error']}"
                st.error(st.session_state.index_status)

        if st.button("Send Context to AI Advisor", key="send_context_btn"):
            st.session_state.ai_context = st.session_state.current_article_text
            st.success("Article context sent to AI Advisor.")
    else:
        st.markdown(
            '<div class="card muted">No article loaded yet. Search Kiwix to fetch emergency content.</div>',
            unsafe_allow_html=True,
        )

with right_col:
    st.subheader("AI Interaction Engine (Ollama)")

    if st.session_state.ai_context.strip():
        st.markdown(
            '<div class="card"><span class="status-pill">RAG Context Active</span>AI responses will reference the last shared article.</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="card muted">No context attached. You can still ask general questions.</div>',
            unsafe_allow_html=True,
        )

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_prompt = st.chat_input("Ask emergency questions, triage steps, or document-specific follow-ups...")

    if user_prompt:
        st.session_state.chat_history.append({"role": "user", "content": user_prompt})
        with st.chat_message("user"):
            st.markdown(user_prompt)

        with st.chat_message("assistant"):
            with st.spinner("Consulting local AI advisor..."):
                if st.session_state.use_sovereign_api:
                    ai = query_sovereign_api(
                        prompt=user_prompt,
                        context=st.session_state.ai_context,
                        server_url=st.session_state.sovereign_api_server,
                        assistant_id=st.session_state.assistant_mode,
                    )
                else:
                    ai = query_ollama(
                        prompt=user_prompt,
                        context=st.session_state.ai_context,
                        server_url=st.session_state.ollama_server,
                        model=st.session_state.ollama_model,
                    )
                if ai["ok"]:
                    st.markdown(ai["response"])
                    st.session_state.chat_history.append({"role": "assistant", "content": ai["response"]})
                else:
                    st.error(ai["error"])
                    st.session_state.chat_history.append({"role": "assistant", "content": f"Error: {ai['error']}"})

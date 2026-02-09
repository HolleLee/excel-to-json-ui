import { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const API_BASE = "http://172.30.94.131:8000";

  const [status, setStatus] = useState("");
  const [finalState, setFinalState] = useState("idle"); 
  // idle | processing | success | error
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
  return localStorage.getItem("darkMode") === "true";
});


  const [backendHistory, setBackendHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("conversionHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // desc | asc



  const startProgress = () => {
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 1 : p));
    }, 80);
  };

  const stopProgress = () => {
    clearInterval(timerRef.current);
  };

  const resetForNextRun = () => {
    setFinalState("idle");
    setStatus("");
    setProgress(0);
    setDownloadUrl("");
    setSelectedFile(null);
  };



  const retryLast = () => {
    if (!selectedFile || loading) return;

    resetForNextRun();
    processExcelFile(selectedFile);
  };


  const processExcelFile = async (file) => {
    if (!file) return;

    if (!file.name.endsWith(".xlsx")) {
      setFinalState("error");
      setStatus("Please upload a .xlsx file");
      return;
    }

    setSelectedFile(file);
    setLoading(true);
    setFinalState("processing");
    setStatus("Processing Excel file…");
    startProgress();

    const start = Date.now();
    setStartTime(start);

    const elapsedTimer = setInterval(() => {
      setElapsed(((Date.now() - start) / 1000).toFixed(1));
    }, 200);

    timerRef.current = elapsedTimer;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/upload-file`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      stopProgress();

      clearInterval(timerRef.current);

      if (data.status === "SUCCESS") {
        setProgress(100);
        setFinalState("success");
        setStatus("Conversion completed successfully");

        const now = new Date().toLocaleString();
        const fullUrl = `${API_BASE}${data.download_url}`;

        setDownloadUrl(fullUrl);

        setHistory((prev) => [
          { excel: file.name, time: now, url: fullUrl },
          ...prev
        ].slice(0, 5));
      } else {
        setFinalState("error");
        // setStatus(data.message || "Conversion failed");
        setStatus(getFriendlyErrorMessage());
        setProgress(0);
      }
    } catch (err) {
      stopProgress();
      setFinalState("error");
      setStatus("Cannot connect to the server. Please try again later.");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

      const filteredHistory = backendHistory
      .filter((item) =>
        item.excel_file
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const t1 = new Date(a.timestamp).getTime();
        const t2 = new Date(b.timestamp).getTime();
        return sortOrder === "desc" ? t2 - t1 : t1 - t2;
      });


  // const getFriendlyErrorMessage = () => {
  //   return "The Excel file does not match the expected template. Please verify the file format and try again.";
  // };

    const getFriendlyErrorMessage = () => {
    return (
      <>
        The Excel file does not match the expected template.
        <br />
        Please verify the file format and try again.
      </>
    );
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (loading) return;
    resetForNextRun();
    processExcelFile(e.dataTransfer.files[0]);
  };

  useEffect(() => {
    localStorage.setItem("conversionHistory", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
  setDarkMode((prev) => !prev);
};

const previewExcel = async (file) => {
  if (!file) return;

  setPreviewLoading(true);
  setShowPreview(true);
  setPreviewData(null);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/preview-excel`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.status === "SUCCESS") {
      setPreviewData(data.preview);
      setActiveSheet(0);
    } else {
      setPreviewData([]);
    }
  } catch {
    setPreviewData([]);
  } finally {
    setPreviewLoading(false);
  }
};

const previewFromHistory = async (historyId) => {
  setPreviewLoading(true);
  setShowPreview(true);
  setPreviewData(null);

  try {
    const res = await fetch(`${API_BASE}/preview-history/${historyId}`);
    const data = await res.json();

    if (data.status === "SUCCESS") {
      setPreviewData(data.preview);
      setActiveSheet(0);
    } else {
      setPreviewData([]);
    }
  } catch {
    setPreviewData([]);
  } finally {
    setPreviewLoading(false);
  }
};


useEffect(() => {
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setBackendHistory(data.history || []);
      }
    } catch {
      // silently fail – history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  loadHistory();
}, []);




  return (
    <div className={`app-bg ${darkMode ? "dark" : ""}`}>

      <div className="app-card">
        <h1>Excel → JSON Config Generator</h1>
        <p className="subtitle">
          Upload an Excel data dictionary to generate JSON configuration
        </p>
        <div className="dark-toggle">
        <span>{darkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={toggleDarkMode} 
          />
          <span className="slider"></span>
        </label>
      </div>


        {/* Drop Zone ALWAYS available */}
        <div
          className={`drop-zone ${loading ? "disabled" : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p className="drop-title">Drag & drop Excel file</p>
          <p className="drop-sub">or</p>
          <label className="file-btn">
            Choose file
            <input
              type="file"
              accept=".xlsx"
              disabled={loading}
              onChange={(e) => {
                resetForNextRun();
                processExcelFile(e.target.files[0]);
              }}
            />
          </label>
        </div>

        {selectedFile && (
          <div className="file-info">
            Selected file: <strong>{selectedFile.name}</strong>
          </div>
        )}

        {/* Progress */}
        {loading && (
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {loading && (
          <div className="muted">
            Processing… {elapsed}s
          </div>
        )}


        {/* FINAL STATUS BANNER */}
        {finalState === "success" && (
          <div className="final-banner success">
            ✔ Conversion completed successfully in {elapsed}s. You can upload another file.
          </div>
        )}

        {finalState === "error" && (
          <div className="final-banner error">
            ✖ {status}
            <div style={{ marginTop: "10px" }}>
              <span className="retry-link" onClick={retryLast}>
                Retry
              </span>
            </div>
          </div>
        )}

        {/* Download */}
        {finalState === "success" && downloadUrl && (
          <a href={downloadUrl} className="primary-btn">
            Download JSON
          </a>
        )}

        {selectedFile && !loading && (
          <div className="preview-link">
            <span onClick={() => previewExcel(selectedFile)}>
              👁 Preview Excel
            </span>
          </div>
        )}

        {showPreview && (
          <div className="preview-overlay">
            <div className="preview-modal">
              <div className="preview-header">
                <strong>Excel Preview</strong>
                <span
                  className="close-btn"
                  onClick={() => setShowPreview(false)}
                >
                  ✖
                </span>
              </div>

              {previewLoading && <div className="muted">Loading preview…</div>}

              {previewData && previewData.length > 0 && (
                <>
                  {/* Sheet Tabs */}
                  <div className="sheet-tabs">
                    {previewData.map((sheet, idx) => (
                      <button
                        key={idx}
                        className={idx === activeSheet ? "active" : ""}
                        onClick={() => setActiveSheet(idx)}
                      >
                        {sheet.sheet_name}
                      </button>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="preview-table">
                    <table>
                      <thead>
                        <tr>
                          {previewData[activeSheet].columns.map((col, i) => (
                            <th key={i}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData[activeSheet].rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!previewLoading && previewData && previewData.length === 0 && (
                <div className="muted">No preview available</div>
              )}
            </div>
          </div>
        )}


        {backendHistory.length > 0 && (
          <div className="history">
            <h3>Recent Runs</h3>

            <div className="history-controls">
              <input
                type="text"
                placeholder="Search by file name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>


            {historyLoading && <div className="muted">Loading history…</div>}

            {filteredHistory.map((item) => (
              <div className="history-item" key={item.id}>
                <div>
                  <strong>{item.excel_file}</strong>
                  <div className="muted">{item.timestamp}</div>
                </div>

                  <div className="history-actions">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        previewFromHistory(item.id);
                      }}
                    >
                      Preview Excel
                    </a>

                    <a href={`${API_BASE}/download/system/${item.system}`}>
                      Download JSON
                    </a>
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

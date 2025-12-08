"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("https://unobservant-florencia-rheumatically.ngrok-free.dev"); // Ganti dengan URL server Anda

interface Contact {
  phone: string;
  name: string;
  status?: "pending" | "success" | "failed";
}

interface BlastSettings {
  minDelay: number;
  maxDelay: number;
  minBatchSize: number;
  maxBatchSize: number;
  minBatchDelay: number;
  maxBatchDelay: number;
}

interface BlastHistory {
  id: string;
  date: string;
  totalContacts: number;
  success: number;
  failed: number;
  message: string;
  hasImage: boolean;
  status: "running" | "completed";
  completedAt?: string;
  contacts: Contact[];
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [qrCode, setQrCode] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"blast" | "history">("blast");
  const [history, setHistory] = useState<BlastHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<BlastHistory | null>(null);

  // Blast Settings
  const [settings, setSettings] = useState<BlastSettings>({
    minDelay: 3,
    maxDelay: 10,
    minBatchSize: 20,
    maxBatchSize: 50,
    minBatchDelay: 30,
    maxBatchDelay: 60,
  });

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    currentIndex: 0,
  });

  // Update stats when contacts change
  useEffect(() => {
    setStats({
      total: contacts.length,
      success: contacts.filter((c) => c.status === "success").length,
      failed: contacts.filter((c) => c.status === "failed").length,
      pending: contacts.filter((c) => c.status === "pending").length,
      currentIndex: contacts.findIndex((c) => c.status === "pending"),
    });
  }, [contacts]);

  useEffect(() => {
    // Listen QR Code
    socket.on("qr", (qrUrl: string) => {
      setQrCode(qrUrl);
      setIsReady(false);
    });

    // Listen WhatsApp Ready
    socket.on("ready", () => {
      setQrCode("");
      setIsReady(true);
    });

    // Listen Progress Blast
    socket.on(
      "blast-progress",
      (data: { phone: string; status: "success" | "failed" }) => {
        setContacts((prev) =>
          prev.map((contact) =>
            contact.phone === data.phone
              ? { ...contact, status: data.status }
              : contact
          )
        );
      }
    );

    socket.on("blast-completed", () => {
      setIsSending(false);
      alert("Blast message selesai!");
    });

    return () => {
      socket.off("qr");
      socket.off("ready");
      socket.off("blast-progress");
      socket.off("blast-completed");
    };
  }, []);

  const handleUploadExcel = async () => {
    if (!excelFile) {
      alert("Pilih file Excel terlebih dahulu!");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate typing effect
    setIsTyping(true);
    const typingInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(typingInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    const formData = new FormData();
    formData.append("excel", excelFile);

    try {
      const response = await axios.post(
        "https://unobservant-florencia-rheumatically.ngrok-free.dev/upload-excel",
        formData
      );
      clearInterval(typingInterval);
      setUploadProgress(100);

      const contactsData = response.data.data.map((c: Contact) => ({
        ...c,
        status: "pending" as const,
      }));
      setContacts(contactsData);

      setTimeout(() => {
        setIsTyping(false);
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      console.error(error);
      clearInterval(typingInterval);
      setIsTyping(false);
      setIsUploading(false);
      setUploadProgress(0);
      alert("Gagal upload Excel");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await axios.post("https://unobservant-florencia-rheumatically.ngrok-free.dev/login", {
        username,
        password,
      });

      if (response.data.status === "success") {
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
      }
    } catch (error: any) {
      setLoginError(
        error.response?.data?.message || "Login gagal. Coba lagi."
      );
    }
  };

  const handleLogout = async () => {
    // Logout web only
    setIsAuthenticated(false);
    setContacts([]);
    setMessage("");
    setImage(null);
    setExcelFile(null);
    localStorage.removeItem("isAuthenticated");
  };

  const handleLogoutWhatsApp = async () => {
    if (confirm("Apakah Anda yakin ingin logout WhatsApp? Ini akan memutus koneksi WhatsApp dan Anda harus scan QR code lagi.")) {
      try {
        await axios.post("https://unobservant-florencia-rheumatically.ngrok-free.dev/logout");
        setIsReady(false);
        setQrCode("");
        alert("WhatsApp berhasil logout. Scan QR code untuk login kembali.");
      } catch (error) {
        console.error("Logout WhatsApp error:", error);
        alert("Gagal logout WhatsApp");
      }
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const auth = localStorage.getItem("isAuthenticated");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Load history when authenticated
  useEffect(() => {
    if (isAuthenticated && activeTab === "history") {
      loadHistory();
    }
  }, [isAuthenticated, activeTab]);

  const loadHistory = async () => {
    try {
      const response = await axios.get("https://unobservant-florencia-rheumatically.ngrok-free.dev/history");
      setHistory(response.data.data);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  const viewHistoryDetail = async (id: string) => {
    try {
      const response = await axios.get(`https://unobservant-florencia-rheumatically.ngrok-free.dev/history/${id}`);
      setSelectedHistory(response.data.data);
    } catch (error) {
      console.error("Failed to load history detail:", error);
    }
  };

  const deleteHistory = async (id: string) => {
    if (confirm("Hapus history ini?")) {
      try {
        await axios.delete(`https://unobservant-florencia-rheumatically.ngrok-free.dev/history/${id}`);
        loadHistory();
        if (selectedHistory?.id === id) {
          setSelectedHistory(null);
        }
      } catch (error) {
        console.error("Failed to delete history:", error);
      }
    }
  };

  const handleSendBlast = async () => {
    if (!message || contacts.length === 0) {
      alert("Isi pesan dan upload Excel terlebih dahulu!");
      return;
    }

    if (!isReady) {
      alert("WhatsApp belum siap! Scan QR code terlebih dahulu.");
      return;
    }

    setIsSending(true);

    const formData = new FormData();
    formData.append("message", message);
    formData.append("targets", JSON.stringify(contacts));
    formData.append(
      "settings",
      JSON.stringify({
        minDelay: settings.minDelay * 1000,
        maxDelay: settings.maxDelay * 1000,
        minBatchSize: settings.minBatchSize,
        maxBatchSize: settings.maxBatchSize,
        minBatchDelay: settings.minBatchDelay * 60 * 1000,
        maxBatchDelay: settings.maxBatchDelay * 60 * 1000,
      })
    );
    if (image) {
      formData.append("image", image);
    }

    try {
      await axios.post("https://unobservant-florencia-rheumatically.ngrok-free.dev/send-blast", formData);
    } catch (error) {
      console.error(error);
      alert("Gagal mengirim blast");
      setIsSending(false);
    }
  };

  // Login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md border border-gray-200">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">
              WhatsApp Blast Pro
            </h1>
            <p className="text-gray-600">Silakan login untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                placeholder="Masukkan username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                placeholder="Masukkan password"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Login
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Default: admin / admin123
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">
                WhatsApp Blast Pro
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Kirim pesan massal dengan personalisasi otomatis
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogoutWhatsApp}
                disabled={!isReady}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                title="Logout WhatsApp saja"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <span className="hidden sm:inline">Logout WA</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
                title="Logout dari aplikasi"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">Logout Web</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("blast")}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === "blast"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Blast Message
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === "history"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              History
            </button>
          </div>
        </div>

        {activeTab === "blast" ? (
          <>
        {/* QR Code Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-black">
              Status WhatsApp
            </h2>
            {isReady && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">
                  Connected
                </span>
              </div>
            )}
          </div>
          {qrCode ? (
            <div className="text-center py-6">
              <p className="mb-4 text-gray-700 font-medium">
                Scan QR Code untuk login WhatsApp:
              </p>
              <div className="inline-block p-4 bg-white rounded-lg shadow-md border-2 border-green-500">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Buka WhatsApp → Menu → Linked Devices → Link a Device
              </p>
            </div>
          ) : isReady ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-3 bg-green-50 text-green-700 px-8 py-4 rounded-lg shadow-sm border border-green-200">
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-semibold text-lg">
                  WhatsApp Siap Digunakan!
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-3 mx-auto"></div>
                <p className="text-gray-600">Menunggu koneksi WhatsApp...</p>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Dashboard */}
        {contacts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
              <p className="text-xs text-gray-600 mb-1">Total Kontak</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
              <p className="text-xs text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-600 mb-1">Berhasil</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.success}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-600 mb-1">Gagal</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
              <p className="text-xs text-gray-600 mb-1">Progress</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.total > 0
                  ? Math.round(
                      ((stats.success + stats.failed) / stats.total) * 100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        )}

        {/* Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Upload & Message */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-black flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Data
              </h2>

              {/* Upload Excel */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-black mb-3">
                  File Excel (Nomor & Nama)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-600 
                      file:mr-4 file:py-3 file:px-6 
                      file:rounded-full file:border-0 
                      file:text-sm file:font-semibold 
                      file:bg-green-600
                      file:text-white hover:file:bg-green-700
                      file:cursor-pointer file:transition-all file:duration-200
                      cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4
                      hover:border-green-400 transition-colors"
                  />
                </div>
                {excelFile && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">{excelFile.name}</span>
                  </div>
                )}

                {isUploading && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      <span className="text-sm text-gray-600">
                        {isTyping ? "Memproses data..." : "Mengupload..."}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUploadExcel}
                  disabled={!excelFile || isUploading}
                  className="mt-4 w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold 
                    hover:bg-green-700 transition-all duration-200 
                    disabled:bg-gray-400 disabled:cursor-not-allowed
                    shadow-sm hover:shadow-md"
                >
                  {isUploading ? "Memproses..." : "Load Kontak dari Excel"}
                </button>
              </div>

              {/* Upload Image */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-black mb-3">
                  Gambar (Opsional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 
                    file:mr-4 file:py-3 file:px-6 
                    file:rounded-full file:border-0 
                    file:text-sm file:font-semibold 
                    file:bg-blue-600
                    file:text-white hover:file:bg-blue-700
                    file:cursor-pointer file:transition-all file:duration-200
                    cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4
                    hover:border-blue-400 transition-colors"
                />
                {image && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">{image.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Message Template */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-black flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                Template Pesan
              </h2>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Halo {nama}, selamat pagi!&#10;&#10;Kami ingin menginformasikan..."
                  rows={8}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-black"
                />
                <div className="absolute bottom-3 right-3 text-xs text-black">
                  {message.length} karakter
                </div>
              </div>
              <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-black flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Gunakan{" "}
                    <code className="bg-white px-2 py-0.5 rounded font-mono text-blue-600">
                      {"{nama}"}
                    </code>{" "}
                    untuk personalisasi otomatis
                  </span>
                </p>
              </div>
            </div>

            {/* Blast Settings */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-black flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Pengaturan Blast
              </h2>

              <div className="space-y-4">
                {/* Delay Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Jeda Min (detik)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.minDelay}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          minDelay: parseInt(e.target.value) || 3,
                        }))
                      }
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Jeda Max (detik)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.maxDelay}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxDelay: parseInt(e.target.value) || 10,
                        }))
                      }
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                    />
                  </div>
                </div>

                {/* Batch Settings */}
                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    Pesan per Batch (Rentang)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Min Pesan
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.minBatchSize}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            minBatchSize: parseInt(e.target.value) || 20,
                          }))
                        }
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Max Pesan
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.maxBatchSize}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            maxBatchSize: parseInt(e.target.value) || 50,
                          }))
                        }
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    Jeda Batch (Rentang Menit)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Min Jeda
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={settings.minBatchDelay}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            minBatchDelay: parseInt(e.target.value) || 30,
                          }))
                        }
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Max Jeda
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={settings.maxBatchDelay}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            maxBatchDelay: parseInt(e.target.value) || 60,
                          }))
                        }
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Estimasi Waktu */}
                {contacts.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="bg-purple-50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-purple-700 font-medium">
                        Akan mengirim ke {contacts.length} kontak
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2">⏱️ Estimasi Waktu:</p>
                      {(() => {
                        const totalContacts = contacts.length;
                        
                        // Hitung estimasi minimal (tercepat)
                        const minTimePerMsg = settings.minDelay; // detik
                        const minBatchCount = Math.floor(totalContacts / settings.maxBatchSize); // jumlah batch minimal
                        const minBatchDelayTotal = minBatchCount * settings.minBatchDelay; // menit
                        const minTotalSeconds = (totalContacts * minTimePerMsg) + (minBatchDelayTotal * 60);
                        const minMinutes = Math.floor(minTotalSeconds / 60);
                        const minHours = Math.floor(minMinutes / 60);
                        const minRemainingMinutes = minMinutes % 60;
                        
                        // Hitung estimasi maksimal (terlama)
                        const maxTimePerMsg = settings.maxDelay; // detik
                        const maxBatchCount = Math.floor(totalContacts / settings.minBatchSize); // jumlah batch maksimal
                        const maxBatchDelayTotal = maxBatchCount * settings.maxBatchDelay; // menit
                        const maxTotalSeconds = (totalContacts * maxTimePerMsg) + (maxBatchDelayTotal * 60);
                        const maxMinutes = Math.floor(maxTotalSeconds / 60);
                        const maxHours = Math.floor(maxMinutes / 60);
                        const maxRemainingMinutes = maxMinutes % 60;
                        
                        return (
                          <div className="space-y-1">
                            <p className="text-xs text-blue-700">
                              <strong>Minimal:</strong> {minHours > 0 ? `${minHours} jam ${minRemainingMinutes} menit` : `${minMinutes} menit`}
                            </p>
                            <p className="text-xs text-blue-700">
                              <strong>Maksimal:</strong> {maxHours > 0 ? `${maxHours} jam ${maxRemainingMinutes} menit` : `${maxMinutes} menit`}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <p className="text-xs text-black">
                    <strong>💡 Rekomendasi:</strong> Jeda 3-10 detik per pesan, batch 20-50 pesan dengan jeda 30-60 menit untuk menghindari banned. Sistem akan memilih nilai random dalam rentang yang ditentukan.
                  </p>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendBlast}
              disabled={isSending || !isReady || contacts.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg
                hover:bg-blue-700 transition-all duration-200 
                disabled:bg-gray-400 disabled:cursor-not-allowed
                shadow-md hover:shadow-lg flex items-center justify-center gap-3"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Mengirim Blast...
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  Kirim Blast Message
                </>
              )}
            </button>
          </div>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-black flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Daftar Kontak
          </span>
          <span className="text-sm font-normal bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
            {contacts.length} kontak
          </span>
        </h2>
        <div className="overflow-y-auto max-h-[800px] -mx-2">
          {contacts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <svg
                className="w-24 h-24 mx-auto text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500 text-lg font-medium mb-2">
                Belum ada kontak
              </p>
              <p className="text-gray-400 text-sm">
                Upload file Excel untuk memulai
              </p>
            </div>
          ) : (
            <div className="space-y-2 px-2">
              {contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    contact.status === "success"
                      ? "bg-green-50 border-green-200"
                      : contact.status === "failed"
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-black truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {contact.phone}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {contact.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium text-gray-600">
                            Pending
                          </span>
                        </div>
                      )}
                      {contact.status === "success" && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-6 h-6 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-xs font-medium text-green-600">
                            Terkirim
                          </span>
                        </div>
                      )}
                      {contact.status === "failed" && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-xs font-medium text-red-600">
                            Gagal
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

        </div>
      </>
        ) : (
          // History Tab
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* History List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h2 className="text-xl font-semibold mb-4 text-black">Riwayat Blast</h2>
                {history.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500">Belum ada history blast</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all cursor-pointer"
                        onClick={() => viewHistoryDetail(item.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-black">
                                {new Date(item.date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {item.status === "running" && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                  Running
                                </span>
                              )}
                              {item.status === "completed" && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  Selesai
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{item.message}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistory(item.id);
                            }}
                            className="ml-4 text-red-600 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs mt-3">
                          <span className="text-gray-600">Total: {item.totalContacts}</span>
                          <span className="text-green-600">✓ {item.success}</span>
                          <span className="text-red-600">✗ {item.failed}</span>
                          {item.hasImage && (
                            <span className="text-blue-600">📎 Gambar</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* History Detail */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-black">Detail</h2>
              {selectedHistory ? (
                <div>
                  <div className="space-y-3 mb-4 pb-4 border-b">
                    <div>
                      <p className="text-xs text-gray-600">Tanggal</p>
                      <p className="text-sm font-medium text-black">
                        {new Date(selectedHistory.date).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <p className={`text-sm font-medium ${selectedHistory.status === "completed" ? "text-green-600" : "text-yellow-600"}`}>
                        {selectedHistory.status === "completed" ? "Selesai" : "Sedang Berjalan"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-600">Total</p>
                        <p className="text-lg font-bold text-blue-600">{selectedHistory.totalContacts}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Berhasil</p>
                        <p className="text-lg font-bold text-green-600">{selectedHistory.success}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Gagal</p>
                        <p className="text-lg font-bold text-red-600">{selectedHistory.failed}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto">
                    <p className="text-sm font-semibold text-black mb-2">Daftar Kontak:</p>
                    <div className="space-y-2">
                      {selectedHistory.contacts.map((contact, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-sm ${
                            contact.status === "success"
                              ? "bg-green-50 border border-green-200"
                              : contact.status === "failed"
                              ? "bg-red-50 border border-red-200"
                              : "bg-gray-50 border border-gray-200"
                          }`}
                        >
                          <p className="font-medium text-black">{contact.name}</p>
                          <p className="text-xs text-gray-600">{contact.phone}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Pilih history untuk melihat detail
                </p>
              )}
            </div>
          </div>
        )}

        {/* Preview Message */}
        {message && contacts.length > 0 && activeTab === "blast" && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-black flex items-center gap-2">
              <svg
                className="w-6 h-6 text-teal-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Preview Pesan
            </h2>
            <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">
                  {contacts[0].name.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm text-gray-600 font-medium">
                  Preview untuk: {contacts[0].name}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <p className="whitespace-pre-wrap text-black leading-relaxed">
                  {message.replace(/{nama}/g, contacts[0].name)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

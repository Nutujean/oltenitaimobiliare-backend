import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../api";

export default function AdaugaAnunt() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState("vand");

  // 👇 Aici ținem fișierele reale + preview-ul lor
  const [images, setImages] = useState([]);        // File[]
  const [previewUrls, setPreviewUrls] = useState([]); // string[]

  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [mustPromote, setMustPromote] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token || token === "undefined" || token === "null" || token.trim() === "") {
      setIsLoggedIn(false);
    } else {
      setIsLoggedIn(true);
    }
  }, [token]);

  const localitati = [
    "Oltenița",
    "Chirnogi",
    "Curcani",
    "Spanțov",
    "Radovanu",
    "Ulmeni",
    "Clătești",
    "Negoești",
    "Șoldanu",
    "Luica",
    "Nana",
    "Budesti",
    "Chiselet",
    "Căscioarele",
    "Mănăstirea",
    "Valea Roșie",
    "Mitreni",
  ];

  const categorii = [
    "Apartamente",
    "Garsoniere",
    "Case",
    "Terenuri",
    "Spatii comerciale",
    "Garaje",
  ];

  // 🔹 Când selectezi imagini
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setImages(files);

    const previews = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(previews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMustPromote(false);

    if (!token) {
      navigate("/login");
      return;
    }

    if (!title || !description || !price || !category || !location || !phone) {
      alert("Completează toate câmpurile obligatorii!");
      return;
    }

    if (parseFloat(price) <= 0) {
      alert("⚠️ Introdu un preț valid, mai mare de 0 euro!");
      return;
    }

    if (!/^0\d{9}$/.test(phone)) {
      alert("⚠️ Număr de telefon invalid (ex: 07xxxxxxxx)");
      return;
    }

    try {
      // 👇 FACEM FormData, nu JSON
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("category", category);
      formData.append("location", location);
      formData.append("phone", phone);
      formData.append("email", email);
      formData.append("intent", intent);

      // 👇 atașăm fișierele, câmpul trebuie să se numească exact "images"
      images.forEach((file) => {
        formData.append("images", file);
      });

      const res = await fetch(`${API_URL}/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // NU punem Content-Type aici!
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.mustPay) {
          setError(
            data.message ||
              "Ai deja un anunț gratuit activ. Pentru a publica încă un anunț, acesta trebuie să fie promovat (plătit)."
          );
          setMustPromote(true);
          return;
        }
        throw new Error(data.error || "Eroare la adăugarea anunțului");
      }

      // ✅ succes
      sessionStorage.setItem("refreshAnunturi", "true");
      sessionStorage.setItem("anuntAdaugat", "✅ Anunțul tău a fost publicat cu succes!");
      navigate("/anunturile-mele");
    } catch (err) {
      console.error("Eroare:", err);
      setError(err.message || "A apărut o eroare la publicarea anunțului.");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">🔒 Acces restricționat</h2>
          <p className="text-gray-600 mb-6">
            Trebuie să fii logat pentru a adăuga un anunț.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/login")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold w-full sm:w-auto"
            >
              🔐 Autentifică-te
            </button>
            <button
              onClick={() => navigate("/inregistrare")}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-semibold w-full sm:w-auto"
            >
              🆕 Creează cont
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-xl">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">
        Adaugă un anunț nou
      </h1>

      {error && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm ${
            mustPromote
              ? "bg-yellow-100 border border-yellow-300 text-yellow-900"
              : "bg-red-100 border border-red-300 text-red-900"
          }`}
        >
          <strong>{mustPromote ? "Ai deja un anunț gratuit activ" : "Eroare"}</strong>
          <p className="mt-1">{error}</p>

          {mustPromote && (
            <p className="mt-2 text-xs text-yellow-800">
              Poți păstra anunțul gratuit existent, iar acesta nou poate fi publicat ca anunț
              promovat (plătit).
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titlu anunț"
          required
          className="w-full border p-2 rounded"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descriere"
          required
          className="w-full border p-2 rounded min-h-[100px]"
        />

        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preț (obligatoriu, în €)"
          required
          min="1"
          step="1"
          className="w-full border p-2 rounded"
        />

        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full border p-2 rounded"
        >
          <option value="">Selectează localitatea</option>
          {localitati.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full border p-2 rounded"
        >
          <option value="">Selectează categoria</option>
          {categorii.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          required
          className="w-full border p-2 rounded"
        >
          <option value="vand">Vând</option>
          <option value="inchiriez">Închiriez</option>
          <option value="cumpar">Cumpăr</option>
          <option value="schimb">Schimb</option>
        </select>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (opțional)"
          className="w-full border p-2 rounded"
        />

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon (07xxxxxxxx)"
          required
          pattern="^0[0-9]{9}$"
          title="Introduceți un număr valid de 10 cifre (ex: 07xxxxxxxx)"
          className="w-full border p-2 rounded"
        />

        <div>
          <label className="block text-sm mb-1">Imagini</label>
          <input type="file" multiple onChange={handleImageChange} />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {previewUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="h-24 w-full object-cover rounded"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg w-full"
        >
          Publică anunțul
        </button>
      </form>
    </div>
  );
}

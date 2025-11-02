import { useState } from "react";
import API_URL from "../api";

export default function AdaugaAnunt() {
  const [titlu, setTitlu] = useState("");
  const [descriere, setDescriere] = useState("");
  const [pret, setPret] = useState("");
  const [categorie, setCategorie] = useState("");
  const [dealType, setDealType] = useState("");
  const [mesaj, setMesaj] = useState("");
  const token = localStorage.getItem("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert("⚠️ Trebuie să fii logat pentru a adăuga un anunț!");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: titlu,
          description: descriere,
          price: pret,
          category: categorie,
          dealType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la adăugare anunț");

      setMesaj("✅ Anunț adăugat cu succes!");
      setTitlu("");
      setDescriere("");
      setPret("");
      setCategorie("");
      setDealType("");
    } catch (err) {
      setMesaj("❌ " + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-lg mx-auto space-y-3">
      <h1 className="text-xl font-bold mb-4">Adaugă un anunț</h1>

      <input
        value={titlu}
        onChange={(e) => setTitlu(e.target.value)}
        placeholder="Titlu"
        className="w-full border p-2 rounded"
      />

      <textarea
        value={descriere}
        onChange={(e) => setDescriere(e.target.value)}
        placeholder="Descriere"
        className="w-full border p-2 rounded"
      />

      <input
        type="number"
        value={pret}
        onChange={(e) => setPret(e.target.value)}
        placeholder="Preț"
        className="w-full border p-2 rounded"
      />

      <select
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
        className="w-full border p-2 rounded"
      >
        <option value="">Selectează categoria</option>
        <option value="Apartamente">Apartamente</option>
        <option value="Case">Case</option>
        <option value="Terenuri">Terenuri</option>
        <option value="Garsoniere">Garsoniere</option>
      </select>

      <select
        value={dealType}
        onChange={(e) => setDealType(e.target.value)}
        className="w-full border border-gray-300 rounded-lg p-2"
      >
        <option value="">Selectează tipul tranzacției</option>
        <option value="vanzare">Vând</option>
        <option value="inchiriere">Închiriez</option>
        <option value="cumparare">Cumpăr</option>
        <option value="schimb">Schimb</option>
      </select>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 transition"
      >
        Salvează
      </button>

      {mesaj && (
        <p className="text-center text-gray-700 mt-3 whitespace-pre-line">
          {mesaj}
        </p>
      )}
    </form>
  );
}

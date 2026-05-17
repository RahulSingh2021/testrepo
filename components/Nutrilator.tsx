"use client";

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Search, 
  Utensils, 
  Package, 
  ChevronRight, 
  ArrowRight,
  Zap,
  Flame,
  Wheat,
  Beef,
  PieChart,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  PlusCircle,
  Info,
  // Fix: Added missing Scale and Droplets icons
  Scale,
  Droplets
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

interface Ingredient {
    id: string;
    name: string;
    calories: number; // per 100g
    protein: number;
    fat: number;
    carbs: number;
}

interface SelectedIngredient extends Ingredient {
    amount: number; // in grams
}

const MOCK_INGREDIENTS: Ingredient[] = [
    { id: '1', name: 'Whole Milk', calories: 42, protein: 3.4, fat: 1, carbs: 5 },
    { id: '2', name: 'Chicken Breast', calories: 165, protein: 31, fat: 3.6, carbs: 0 },
    { id: '3', name: 'White Rice', calories: 130, protein: 2.7, fat: 0.3, carbs: 28 },
    { id: '4', name: 'Olive Oil', calories: 884, protein: 0, fat: 100, carbs: 0 },
    { id: '5', name: 'Broccoli', calories: 34, protein: 2.8, fat: 0.4, carbs: 7 },
    { id: '6', name: 'Eggs', calories: 155, protein: 13, fat: 11, carbs: 1.1 },
    { id: '7', name: 'Beef Mutton Keema', calories: 250, protein: 26, fat: 15, carbs: 0 },
    { id: '8', name: 'Almonds', calories: 579, protein: 21, fat: 49, carbs: 22 },
];

const Nutrilator: React.FC = () => {
    const [recipeTitle, setRecipeTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prepTime, setPrepTime] = useState("");
    const [cookTime, setCookTime] = useState("");
    const [servings, setServings] = useState("1");
    const [showDescription, setShowDescription] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);

    const filteredOptions = useMemo(() => {
        return MOCK_INGREDIENTS.filter(i => 
            i.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const addIngredient = (ing: Ingredient) => {
        if (selectedIngredients.find(i => i.id === ing.id)) return;
        setSelectedIngredients([...selectedIngredients, { ...ing, amount: 0 }]);
        setSearchTerm("");
    };

    const removeIngredient = (id: string) => {
        setSelectedIngredients(selectedIngredients.filter(i => i.id !== id));
    };

    const updateAmount = (id: string, amount: number) => {
        setSelectedIngredients(selectedIngredients.map(i => 
            i.id === id ? { ...i, amount: isNaN(amount) ? 0 : amount } : i
        ));
    };

    const totals = useMemo(() => {
        const numServings = parseFloat(servings) || 1;
        const rawTotals = selectedIngredients.reduce((acc, curr) => {
            const factor = curr.amount / 100;
            return {
                calories: acc.calories + (curr.calories * factor),
                protein: acc.protein + (curr.protein * factor),
                fat: acc.fat + (curr.fat * factor),
                carbs: acc.carbs + (curr.carbs * factor),
                weight: acc.weight + curr.amount
            };
        }, { calories: 0, protein: 0, fat: 0, carbs: 0, weight: 0 });

        return {
            calories: rawTotals.calories / numServings,
            protein: rawTotals.protein / numServings,
            fat: rawTotals.fat / numServings,
            carbs: rawTotals.carbs / numServings,
            weight: rawTotals.weight / numServings
        };
    }, [selectedIngredients, servings]);

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            <h1 className="text-3xl font-light text-center text-slate-700 py-4">Recipe Maker</h1>

            {/* STEP 1: Recipe Overview */}
            <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                <div className="bg-[#5cb85c] px-4 py-2 flex items-center gap-3">
                    <span className="bg-white text-[#5cb85c] text-[10px] font-bold px-2 py-0.5 rounded">STEP 1</span>
                    <h2 className="text-white text-xs font-bold uppercase tracking-wider">Recipe Overview</h2>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Recipe Title:</label>
                            <input 
                                type="text"
                                value={recipeTitle}
                                onChange={e => setRecipeTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Image (Optional):</label>
                                <div className="flex items-center gap-2 border border-slate-300 rounded px-2 py-1.5 bg-slate-50">
                                    <input type="file" className="text-[10px] w-40" />
                                </div>
                            </div>
                            <div className="w-20 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Prep Time:</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g., 20m"
                                    value={prepTime}
                                    onChange={e => setPrepTime(e.target.value)}
                                    className="w-full border border-slate-300 rounded px-2 py-2 text-xs text-center"
                                />
                            </div>
                            <div className="w-20 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Cook Time:</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g., 45m"
                                    value={cookTime}
                                    onChange={e => setCookTime(e.target.value)}
                                    className="w-full border border-slate-300 rounded px-2 py-2 text-xs text-center"
                                />
                            </div>
                            <div className="w-20 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Servings:</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g., 4"
                                    value={servings}
                                    onChange={e => setServings(e.target.value)}
                                    className="w-full border border-slate-300 rounded px-2 py-2 text-xs text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 relative">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Description:</label>
                            <button 
                                onClick={() => setShowDescription(!showDescription)}
                                className="bg-slate-600 text-white text-[9px] font-bold px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                            >
                                {showDescription ? 'Hide Description' : 'Show Description'}
                            </button>
                        </div>
                        {showDescription && (
                            <textarea 
                                rows={4}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Enter a brief description of the recipe..."
                                className="w-full border border-slate-300 rounded p-3 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* STEP 2: Ingredients Management & List */}
            <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                <div className="bg-[#5cb85c] px-4 py-2 flex items-center gap-3">
                    <span className="bg-white text-[#5cb85c] text-[10px] font-bold px-2 py-0.5 rounded">STEP 2</span>
                    <h2 className="text-white text-xs font-bold uppercase tracking-wider">Ingredients Management & List</h2>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Upload Ingredients File (CSV)</label>
                            <div className="flex items-center gap-2">
                                <div className="border border-slate-300 rounded px-2 py-1.5 bg-slate-50">
                                    <input type="file" className="text-[10px] w-48" />
                                </div>
                                <button className="bg-[#5cb85c] text-white text-xs font-bold px-4 py-2 rounded hover:bg-[#4cae4c]">Process File</button>
                            </div>
                            <p className="text-[9px] text-indigo-600 underline cursor-pointer">Download Sample CSV <span className="text-slate-400 no-underline">(Format: "Name", "Qty (g)")</span></p>
                        </div>

                        <div className="flex-1 max-w-2xl space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Search & Add from Database</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="text"
                                        placeholder="Type to search ingredients or recipes..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                    {searchTerm && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {filteredOptions.map(ing => (
                                                <button 
                                                    key={ing.id}
                                                    onClick={() => addIngredient(ing)}
                                                    className="w-full text-left p-2 hover:bg-slate-50 text-[10px] font-bold uppercase border-b border-slate-100 last:border-0"
                                                >
                                                    {ing.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button className="bg-slate-600 text-white text-[10px] font-bold px-4 py-2 rounded hover:bg-slate-700">Add Manual</button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-2 border-r border-slate-200 w-8 text-center">Sel.</th>
                                    <th className="p-2 border-r border-slate-200 w-8 text-center">#</th>
                                    <th className="p-2 border-r border-slate-200 w-12 text-center">Logo</th>
                                    <th className="p-2 border-r border-slate-200 w-24">Qty (g)</th>
                                    <th className="p-2 border-r border-slate-200">Ingredient Name (User)</th>
                                    <th className="p-2 border-r border-slate-200">DB Name</th>
                                    <th className="p-2 border-r border-slate-200">Keyword</th>
                                    <th className="p-2 border-r border-slate-200">Ref</th>
                                    <th className="p-2 border-r border-slate-200">Allergen</th>
                                    <th className="p-2 border-r border-slate-200">Energy</th>
                                    <th className="p-2 border-r border-slate-200">Protein</th>
                                    <th className="p-2 border-r border-slate-200">Carb</th>
                                    <th className="p-2 border-r border-slate-200">Fat</th>
                                    <th className="p-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedIngredients.length > 0 ? selectedIngredients.map((ing, idx) => (
                                    <tr key={ing.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="p-2 border-r border-slate-200 text-center"><input type="checkbox" /></td>
                                        <td className="p-2 border-r border-slate-200 text-center">{idx + 1}</td>
                                        <td className="p-2 border-r border-slate-200 text-center text-emerald-600"><Package size={14} className="mx-auto" /></td>
                                        <td className="p-2 border-r border-slate-200">
                                            <input 
                                                type="number"
                                                value={ing.amount}
                                                onChange={e => updateAmount(ing.id, parseFloat(e.target.value))}
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-500"
                                            />
                                        </td>
                                        <td className="p-2 border-r border-slate-200">
                                            <input 
                                                type="text"
                                                defaultValue={ing.name}
                                                className="w-full border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                                            />
                                        </td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400 font-medium italic">{ing.name}</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400">-</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400">-</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400">-</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400 text-center">{(ing.calories * (ing.amount/100)).toFixed(2)}</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400 text-center">{(ing.protein * (ing.amount/100)).toFixed(2)}</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400 text-center">{(ing.carbs * (ing.amount/100)).toFixed(2)}</td>
                                        <td className="p-2 border-r border-slate-200 bg-slate-50 text-slate-400 text-center">{(ing.fat * (ing.amount/100)).toFixed(2)}</td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeIngredient(ing.id)} className="bg-rose-500 text-white text-[9px] font-bold px-2 py-1 rounded hover:bg-rose-600">Remove</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={14} className="p-12 text-center text-slate-400 italic font-medium">No ingredients added yet. Search from the database to begin.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                <tr>
                                    <td colSpan={2} className="p-2 text-right uppercase">Total (for 1 serving):</td>
                                    <td className="p-2 text-center text-emerald-600"><Package size={14} className="mx-auto" /></td>
                                    <td className="p-2 border-r border-slate-200">{totals.weight.toFixed(0)} g</td>
                                    <td colSpan={5} className="p-2 border-r border-slate-200 text-center text-slate-400">N/A</td>
                                    <td className="p-2 border-r border-slate-200 text-center">{totals.calories.toFixed(2)}</td>
                                    <td className="p-2 border-r border-slate-200 text-center">{totals.protein.toFixed(2)}</td>
                                    <td className="p-2 border-r border-slate-200 text-center">{totals.carbs.toFixed(2)}</td>
                                    <td className="p-2 border-r border-slate-200 text-center">{totals.fat.toFixed(2)}</td>
                                    <td className="p-2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-between items-center">
                        <button className="bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded hover:bg-rose-600">Delete Selected</button>
                        <button className="bg-indigo-600 text-white text-xs font-bold px-10 py-3 rounded shadow-lg hover:bg-indigo-500 transition-all">Save Recipe Profile</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Nutrilator;
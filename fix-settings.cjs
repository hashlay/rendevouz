const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf-8');

// 1. Add globalPoints to state
content = content.replace(/const \[maxGroupEvents, setMaxGroupEvents\] = useState\(2\);/, 
`const [maxGroupEvents, setMaxGroupEvents] = useState(2);
  const [globalPoints1, setGlobalPoints1] = useState(20);
  const [globalPoints2, setGlobalPoints2] = useState(14);
  const [globalPoints3, setGlobalPoints3] = useState(7);
  const [globalPoints4, setGlobalPoints4] = useState(5);
  const [globalPoints5, setGlobalPoints5] = useState(4);
  const [globalPoints6, setGlobalPoints6] = useState(3);
  const [globalPoints7, setGlobalPoints7] = useState(2);
  const [globalPoints8, setGlobalPoints8] = useState(1);
  const [globalPoints9, setGlobalPoints9] = useState(1);
  const [globalPoints10, setGlobalPoints10] = useState(1);`);

// 2. Fetch globalPoints in fetchSettingsAndUnits
content = content.replace(/setMaxGroupEvents\(data.maxGroupEvents \|\| 2\);/, 
`setMaxGroupEvents(data.maxGroupEvents || 2);
      setGlobalPoints1(data.globalPointsRank1 || 20);
      setGlobalPoints2(data.globalPointsRank2 || 14);
      setGlobalPoints3(data.globalPointsRank3 || 7);
      setGlobalPoints4(data.globalPointsRank4 || 5);
      setGlobalPoints5(data.globalPointsRank5 || 4);
      setGlobalPoints6(data.globalPointsRank6 || 3);
      setGlobalPoints7(data.globalPointsRank7 || 2);
      setGlobalPoints8(data.globalPointsRank8 || 1);
      setGlobalPoints9(data.globalPointsRank9 || 1);
      setGlobalPoints10(data.globalPointsRank10 || 1);`);

// 3. Save globalPoints in handleSaveSettings
content = content.replace(/maxGroupEvents,/g, 
`maxGroupEvents,
          globalPointsRank1: globalPoints1,
          globalPointsRank2: globalPoints2,
          globalPointsRank3: globalPoints3,
          globalPointsRank4: globalPoints4,
          globalPointsRank5: globalPoints5,
          globalPointsRank6: globalPoints6,
          globalPointsRank7: globalPoints7,
          globalPointsRank8: globalPoints8,
          globalPointsRank9: globalPoints9,
          globalPointsRank10: globalPoints10,`);

// 4. Add Global Points UI just above Program Limits Controls
const pointsHtml = `{/* Global Points System */}
          <div className="space-y-2 pt-2 border-t border-slate-200 mt-4">
            <label className="block text-[10px] font-extrabold text-slate-900 uppercase tracking-wider font-mono">Global Points Distribution (Ranks 1st through 10th)</label>
            <p className="text-[11px] text-slate-500 mb-2">This single point system applies to all categories.</p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[
                { label: '1st', state: globalPoints1, setter: setGlobalPoints1, color: 'text-emerald-700 font-extrabold' },
                { label: '2nd', state: globalPoints2, setter: setGlobalPoints2, color: 'text-slate-800 font-extrabold' },
                { label: '3rd', state: globalPoints3, setter: setGlobalPoints3, color: 'text-orange-700 font-extrabold' },
                { label: '4th', state: globalPoints4, setter: setGlobalPoints4, color: 'text-slate-700 font-bold' },
                { label: '5th', state: globalPoints5, setter: setGlobalPoints5, color: 'text-slate-700 font-bold' },
                { label: '6th', state: globalPoints6, setter: setGlobalPoints6, color: 'text-slate-700 font-bold' },
                { label: '7th', state: globalPoints7, setter: setGlobalPoints7, color: 'text-slate-700 font-bold' },
                { label: '8th', state: globalPoints8, setter: setGlobalPoints8, color: 'text-slate-600' },
                { label: '9th', state: globalPoints9, setter: setGlobalPoints9, color: 'text-slate-600' },
                { label: '10th', state: globalPoints10, setter: setGlobalPoints10, color: 'text-slate-600' }
              ].map(item => (
                <div key={item.label}>
                  <label className="block text-[9px] font-bold text-slate-500 text-center font-mono">{item.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={item.state}
                    onChange={(e) => item.setter(Number(e.target.value))}
                    className={\`mt-0.5 block w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-xs font-mono \${item.color}\`}
                  />
                </div>
              ))}
            </div>
          </div>`;
content = content.replace('{/* Program Limits Controls */}', pointsHtml + '\n\n          {/* Program Limits Controls */}');

// 5. Add dobStart, dobEnd, classStart, classEnd to Category State
content = content.replace(/const \[catStartChestNo, setCatStartChestNo\] = useState\(1001\);/, 
`const [catStartChestNo, setCatStartChestNo] = useState(1001);
  const [catCriteria, setCatCriteria] = useState<'dob'|'class'>('dob');
  const [catDobStart, setCatDobStart] = useState('');
  const [catDobEnd, setCatDobEnd] = useState('');
  const [catClassStart, setCatClassStart] = useState('');
  const [catClassEnd, setCatClassEnd] = useState('');`);

// 6. Fix handleSaveCategoryInSettings payload
content = content.replace(/body: JSON.stringify\(\{ name: catName, startingChestNumber: catStartChestNo.*\}\)/s, 
`body: JSON.stringify({ 
          name: catName, 
          startingChestNumber: catStartChestNo,
          criteriaType: catCriteria,
          dobStart: catDobStart,
          dobEnd: catDobEnd,
          classStart: catClassStart,
          classEnd: catClassEnd
        })`);
        
// 7. Update editingCatId setter
content = content.replace(/setCatStartChestNo\(cat.startingChestNumber \|\| 1001\);/,
`setCatStartChestNo(cat.startingChestNumber || 1001);
                        setCatCriteria(cat.criteriaType || 'dob');
                        setCatDobStart(cat.dobStart || '');
                        setCatDobEnd(cat.dobEnd || '');
                        setCatClassStart(cat.classStart || '');
                        setCatClassEnd(cat.classEnd || '');`);

// 8. Remove the old points 1-10 from Category Manager entirely
content = content.replace(/const \[points1, setPoints1\] = useState[\s\S]*?const \[points10, setPoints10\] = useState\(1\);/, '');
content = content.replace(/setPoints1\(.*\);[\s\S]*?setPoints10\(.*\);/, '');
content = content.replace(/<th className="p-3">1st - 3rd Pts<\/th>[\s\S]*?<th className="p-3">8th - 10th Pts<\/th>/, 
`<th className="p-3">Criteria</th>`);
content = content.replace(/<td className="p-3 font-mono font-bold text-emerald-700">\{cat.pointsRank1.*\/td>[\s\S]*?<td className="p-3 font-mono text-slate-500">.*<\/td>/, 
`<td className="p-3 text-slate-600">
                    {cat.criteriaType === 'dob' && (cat.dobStart || cat.dobEnd) ? \`DOB: \${cat.dobStart || '*'} to \${cat.dobEnd || '*'}\` : ''}
                    {cat.criteriaType === 'class' && (cat.classStart || cat.classEnd) ? \`Class: \${cat.classStart || '*'} to \${cat.classEnd || '*'}\` : ''}
                  </td>`);
content = content.replace(/{editingCatId \? \`Edit Points for "\{catName\}"\` : '\+ Add New Category & Configure 1st-10th Rank Points'}/, 
`{editingCatId ? \`Edit Category "\${catName}"\` : '+ Add New Category'}`);
content = content.replace(/Edit Points<\/button>/, 'Edit</button>');

// 9. Remove points grid from category form and replace with criteria
content = content.replace(/{\/\* 1st to 10th Place Points Grid \*\/}*[\s\S]*?{\/\* 2\. Units \/ Houses \/ Teams Manager \*\//, 
`{/* Criteria Settings */}
          <div className="space-y-3 pt-2 border-t border-purple-200/60">
            <div className="flex items-center gap-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Criteria Type</label>
              <select value={catCriteria} onChange={(e) => setCatCriteria(e.target.value as any)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs">
                <option value="dob">Date of Birth</option>
                <option value="class">Class/Grade</option>
              </select>
            </div>
            
            {catCriteria === 'dob' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB Start (Optional)</label>
                  <input type="date" value={catDobStart} onChange={(e) => setCatDobStart(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB End (Optional)</label>
                  <input type="date" value={catDobEnd} onChange={(e) => setCatDobEnd(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Class Start (Optional)</label>
                  <input type="text" value={catClassStart} onChange={(e) => setCatClassStart(e.target.value)} placeholder="e.g. 5" className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Class End (Optional)</label>
                  <input type="text" value={catClassEnd} onChange={(e) => setCatClassEnd(e.target.value)} placeholder="e.g. 7" className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-extrabold shadow cursor-pointer"
            >
              {editingCatId ? 'Update Category' : '+ Save Category'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Units / Houses / Teams Manager */}`);

fs.writeFileSync('src/components/SettingsView.tsx', content);

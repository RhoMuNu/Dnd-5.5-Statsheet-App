import { RULE_TERM_REFERENCES } from "../data/abilityReferences";
import { referencedSpells } from "../data/featureDescriptions";

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => part.startsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("*") ? <em key={index}>{part.slice(1, -1)}</em> : part);
}
const cells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

export function RulesDescription({ description, related = true }: { description: string; related?: boolean }) {
  const spells = related ? referencedSpells(description) : [];
  const terms = related ? Object.entries(RULE_TERM_REFERENCES).filter(([name]) => description.toLowerCase().includes(name.toLowerCase())) : [];
  return <div className="rules-description">{description.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const rows = block.trim().split("\n");
    if (rows.length >= 2 && rows[0].includes("|") && /^[\s|:-]+$/.test(rows[1]) && rows[1].includes("---")) return <div className="rule-table-scroll" key={index}><table><thead><tr>{cells(rows[0]).map((cell, column) => <th key={column}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.slice(2).map((row, number) => <tr key={number}>{cells(row).map((cell, column) => <td key={column}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
    if (rows.every((row) => /^[-*] /.test(row))) return <ul key={index}>{rows.map((row, number) => <li key={number}>{inline(row.slice(2))}</li>)}</ul>;
    if (/^#{1,5} /.test(block)) return <p className="rule-subheading" key={index}><strong>{inline(block.replace(/^#{1,5} /, ""))}</strong></p>;
    return <p key={index}>{rows.map((row, number) => <span key={number}>{number > 0 && <br />}{inline(row)}</span>)}</p>;
  })}
    {(terms.length > 0 || spells.length > 0) && <div className="rule-linked-references">{terms.map(([name, text]) => <details key={name}><summary>{name} reminder</summary><p>{text}</p></details>)}{spells.map((spell) => <details key={spell.key}><summary>Spell reference: {spell.name}</summary><p>{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.castingTime} · {spell.range} · {spell.components}{spell.concentration ? " · Concentration" : ""}</p><RulesDescription description={spell.description} related={false} /></details>)}</div>}
  </div>;
}

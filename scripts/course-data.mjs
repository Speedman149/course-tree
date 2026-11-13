/**
 * Conservative parser for the public Technion SAP snapshot format.
 * No operator is inferred between adjacent course IDs, and mixed operators
 * at the same parenthesis depth are considered ambiguous.
 */
export function normalizeCourseId(value) {
  const id = String(value).trim();
  if (!/^\d{5,8}$/.test(id)) throw new Error(`Invalid course ID: ${id}`);
  if (id.length <= 6) {
    const old = id.padStart(6, '0');
    const special = /^9730(\d{2})$/.exec(old);
    return special ? `970300${special[1]}` : `0${old.slice(0, 3)}0${old.slice(3)}`;
  }
  return id.padStart(8, '0');
}

export function courseAliases(id) {
  const aliases = new Set([id.replace(/^0+/, '')]);
  const special = /^970300(\d{2})$/.exec(id);
  const ordinary = /^0(\d{3})0(\d{3})$/.exec(id);
  if (special) aliases.add(`9730${special[1]}`);
  else if (ordinary && !/^097300\d{2}$/.test(id)) {
    const old = ordinary[1] + ordinary[2];
    aliases.add(old);
    aliases.add(old.replace(/^0+/, ''));
  }
  aliases.delete(id);
  return [...aliases].filter(Boolean);
}

export function courseInfoUrl(id, term) {
  if (!/^\d{8}$/.test(id) || !/^\d{4}_20[012]$/.test(term)) throw new Error('Course links require a canonical ID and source term');
  const [year, session] = term.split('_');
  return `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/${year}/${session}/SM/${id}`;
}

export function group(type, items) {
  const flat = items.flatMap(item => item.type === type ? item.items : [item]);
  const seen = new Set();
  const unique = flat.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length === 1 ? unique[0] : { type, items: unique };
}

export function parseRequirement(text, relation = 'strong') {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const tokens = [];
  let offset = 0;
  while (offset < raw.length) {
    const rest = raw.slice(offset);
    const token = /^(\s+|\d{5,8}|או|ו\s*[-־]|[()])/.exec(rest)?.[0];
    if (!token) throw new Error(`Unsupported prerequisite text at ${offset}`);
    offset += token.length;
    if (!/^\s+$/.test(token)) tokens.push(token);
  }
  let index = 0;
  const parseAtom = () => {
    const token = tokens[index++];
    if (token === '(') {
      const value = parseGroup();
      if (tokens[index++] !== ')') throw new Error('Unbalanced parentheses');
      return value;
    }
    if (!token || !/^\d{5,8}$/.test(token)) throw new Error('Expected a course ID');
    return { type: 'course', courseId: normalizeCourseId(token), relation };
  };
  const parseGroup = () => {
    const items = [parseAtom()];
    let operator;
    while (index < tokens.length && tokens[index] !== ')') {
      const token = tokens[index++];
      const next = token === 'או' ? 'or' : /^ו\s*[-־]$/.test(token) ? 'and' : null;
      if (!next) throw new Error('Missing explicit AND/OR operator');
      if (operator && operator !== next) throw new Error('Mixed AND/OR without explicit grouping');
      operator = next;
      items.push(parseAtom());
    }
    return operator ? group(operator, items) : items[0];
  };
  const result = parseGroup();
  if (index !== tokens.length) throw new Error('Unbalanced parentheses');
  return result;
}

export function concurrentNote(notes) {
  return /^(?:מקצוע צמוד|מקצועות צמודים):\s*([^\n]*)/m.exec(notes || '')?.[1]?.trim() || '';
}

function parseConcurrent(general) {
  const raw = String(general['מקצועות צמודים'] || '').trim();
  if (!raw) return null;
  if (!/^\d{5,8}(?:\s+\d{5,8})*$/.test(raw)) throw new Error('Unsupported concurrent requirement text');
  const listed = raw.match(/\d{5,8}/g) || [];
  const ids = [...new Set(listed.map(normalizeCourseId))];
  if (ids.length === 1) return { type: 'course', courseId: ids[0], relation: 'concurrent' };
  // The source flattens concurrent OR lists into whitespace-separated IDs.
  // Recover an explicit OR only when the original note unambiguously supplies it.
  const note = concurrentNote(general['הערות']);
  const alternatives = note.split(/\s+או\s+/);
  if (alternatives.length > 1 && alternatives.every(part => /^\d{5,8}(?:\s+[^\d]*)?$/.test(part.trim()))) {
    const parsedIds = alternatives.map(part => normalizeCourseId(/^\d{5,8}/.exec(part.trim())[0]));
    if (JSON.stringify([...new Set(parsedIds)].sort()) === JSON.stringify([...ids].sort())) {
      return group('or', parsedIds.map(courseId => ({ type: 'course', courseId, relation: 'concurrent' })));
    }
  }
  throw new Error('Concurrent list has no explicit AND/OR rule; original note retained');
}

export function extractRequirements(general) {
  const strong = String(general['מקצועות קדם'] || '').trim();
  const concurrent = String(general['מקצועות צמודים'] || '').trim();
  const note = concurrentNote(general['הערות']);
  const rawRequirements = [strong && `מקצועות קדם: ${strong}`, concurrent && `מקצועות צמודים: ${note || concurrent}`].filter(Boolean).join('\n');
  if (!strong && !concurrent) {
    return { requirements: null, requirementsStatus: 'none' };
  }
  try {
    const parts = [parseRequirement(strong), parseConcurrent(general)].filter(Boolean);
    return { requirements: group('and', parts), requirementsStatus: 'known', rawRequirements };
  } catch (error) {
    return { requirements: null, requirementsStatus: 'unparsed', rawRequirements, unparsedReason: error.message };
  }
}

export function requirementLeaves(requirement) {
  if (!requirement) return [];
  return requirement.type === 'course' ? [requirement] : requirement.items.flatMap(requirementLeaves);
}

export function mergeSnapshots(snapshots) {
  const selected = new Map();
  const history = new Map();
  for (const snapshot of [...snapshots].sort((a, b) => a.term.localeCompare(b.term))) {
    const termIds = new Set();
    for (const entry of snapshot.records) {
      const general = entry.general;
      if (!general || !general['מספר מקצוע'] || !general['שם מקצוע']) throw new Error(`Invalid record in ${snapshot.term}`);
      const id = normalizeCourseId(general['מספר מקצוע']);
      if (termIds.has(id)) throw new Error(`Duplicate course ${id} within ${snapshot.term}; resolve source ambiguity first`);
      termIds.add(id);
      const rawSignature = JSON.stringify([general['מקצועות קדם'] || '', general['מקצועות צמודים'] || '', concurrentNote(general['הערות'])]);
      const previous = history.get(id) || [];
      previous.push({ term: snapshot.term, rawSignature });
      history.set(id, previous);
      const parsed = extractRequirements(general);
      const credits = Number(general['נקודות']);
      selected.set(id, {
        id,
        aliases: courseAliases(id),
        name: String(general['שם מקצוע']).replace(/\s+/g, ' ').trim(),
        faculty: general['פקולטה'] || 'יחידה אקדמית לא ידועה',
        ...(Number.isFinite(credits) ? { credits } : {}),
        ...parsed,
        source: {
          url: courseInfoUrl(id, snapshot.term),
          term: snapshot.term,
          label: 'Technion SAP · מאגר CheeseFork',
          dataUrl: snapshot.url,
          snapshotSha256: snapshot.sha256,
        },
      });
    }
  }
  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id)).map(course => {
    const entries = history.get(course.id);
    const signatures = new Set(entries.map(entry => entry.rawSignature));
    return {
      ...course,
      availableSourceTerms: entries.map(entry => entry.term),
      requirementsChanged: signatures.size > 1,
      ...(signatures.size > 1 ? { previousRequirements: entries.slice(0, -1).map(entry => ({ term: entry.term, raw: JSON.parse(entry.rawSignature) })) } : {}),
    };
  });
}

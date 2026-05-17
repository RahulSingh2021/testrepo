const SPELLING_MAP: Record<string, string> = {
    'teh': 'the', 'thier': 'their', 'recieve': 'receive', 'occured': 'occurred',
    'occuring': 'occurring', 'seperate': 'separate', 'definately': 'definitely',
    'accomodate': 'accommodate', 'occurence': 'occurrence', 'maintainence': 'maintenance',
    'temprature': 'temperature', 'temperture': 'temperature', 'tempature': 'temperature',
    'hygeine': 'hygiene', 'hygene': 'hygiene', 'hyigene': 'hygiene',
    'sanitisation': 'sanitization', 'contamiation': 'contamination', 'contaminaton': 'contamination',
    'refridgerator': 'refrigerator', 'fridg': 'fridge',
    'equipement': 'equipment', 'equpiment': 'equipment', 'equipments': 'equipment',
    'cleanlyness': 'cleanliness', 'cleaniness': 'cleanliness', 'clenliness': 'cleanliness',
    'complience': 'compliance', 'compliane': 'compliance', 'compliace': 'compliance',
    'insepction': 'inspection', 'inspecton': 'inspection', 'inspction': 'inspection',
    'obervation': 'observation', 'observaton': 'observation', 'obsrvation': 'observation',
    'proceedure': 'procedure', 'procedue': 'procedure', 'procedre': 'procedure',
    'identifed': 'identified', 'identifyed': 'identified',
    'immediatly': 'immediately', 'imediately': 'immediately', 'immedietly': 'immediately',
    'neccessary': 'necessary', 'neccesary': 'necessary', 'necesary': 'necessary',
    'restarant': 'restaurant', 'resturant': 'restaurant', 'restaraunt': 'restaurant',
    'enviroment': 'environment', 'envirnoment': 'environment', 'enviorment': 'environment',
    'expiraton': 'expiration', 'expiray': 'expiry',
    'allergan': 'allergen', 'alegen': 'allergen',
    'saftey': 'safety', 'safty': 'safety',
    'hieght': 'height', 'heigth': 'height', 'hight': 'height', 'heght': 'height',
    'fssai': 'FSSAI', 'fsaai': 'FSSAI', 'fssaai': 'FSSAI', 'fssai\'s': "FSSAI's",
    'haccp': 'HACCP', 'hacp': 'HACCP', 'hacpp': 'HACCP',
    'hazrad': 'hazard', 'hazzard': 'hazard',
    'stoarge': 'storage', 'storge': 'storage',
    'ventilaton': 'ventilation', 'ventiltion': 'ventilation',
    'calibartion': 'calibration', 'calibraton': 'calibration',
    'documentaion': 'documentation', 'documention': 'documentation',
    'traning': 'training', 'trainning': 'training',
    'catcher': 'catcher', 'catchers': 'catchers',
    'notised': 'noticed', 'noticied': 'noticed', 'noitced': 'noticed',
    'instaled': 'installed', 'insatlled': 'installed', 'installled': 'installed',
    'standrad': 'standard', 'stanard': 'standard', 'standrd': 'standard',
    'continuosly': 'continuously', 'continously': 'continuously', 'contineously': 'continuously',
    'condtion': 'condition', 'conditon': 'condition', 'conditoin': 'condition',
    'acording': 'according', 'acordingly': 'accordingly',
    'postion': 'position', 'positon': 'position',
    'certifcate': 'certificate', 'certificte': 'certificate', 'certifiate': 'certificate',
    'lable': 'label', 'labl': 'label', 'labling': 'labeling', 'labelling': 'labeling',
    'expred': 'expired', 'expierd': 'expired',
    'regulaton': 'regulation', 'regultion': 'regulation',
    'pest': 'pest', 'pset': 'pest',
    'infestaton': 'infestation', 'infestion': 'infestation',
    'drianage': 'drainage', 'drinage': 'drainage',
    'grease': 'grease', 'greese': 'grease',
    'utensil': 'utensil', 'utensl': 'utensil', 'utensils': 'utensils',
    'workin': 'working', 'workig': 'working',
    'recored': 'recorded', 'recrded': 'recorded',
    'higer': 'higher', 'highr': 'higher',
    'approriate': 'appropriate',
    'reccomend': 'recommend', 'recomend': 'recommend',
    'managment': 'management', 'managemnt': 'management',
    'requirment': 'requirement', 'requiremnt': 'requirement',
    'corective': 'corrective',
    'preventative': 'preventive',
    'recieved': 'received', 'recived': 'received',
    'appropirate': 'appropriate', 'apropriate': 'appropriate',
    'sufficent': 'sufficient', 'sufficiant': 'sufficient',
    'inadquate': 'inadequate', 'inadequte': 'inadequate',
    'wich': 'which', 'whcih': 'which',
    'becuase': 'because', 'beacuse': 'because', 'becasue': 'because',
    'thru': 'through', 'thrugh': 'through',
    'untill': 'until', 'untl': 'until',
    'excesive': 'excessive', 'exessive': 'excessive',
    'acheive': 'achieve', 'achive': 'achieve',
    'acess': 'access', 'acccess': 'access',
    'brekage': 'breakage', 'breakge': 'breakage',
    'approvel': 'approval', 'aproval': 'approval',
    'dont': "don't", 'doesnt': "doesn't", 'cant': "can't", 'wont': "won't",
    'isnt': "isn't", 'wasnt': "wasn't", 'havent': "haven't", 'hasnt': "hasn't",
    'didnt': "didn't", 'shouldnt': "shouldn't", 'wouldnt': "wouldn't", 'couldnt': "couldn't",
    'alot': 'a lot', 'aswell': 'as well', 'incase': 'in case',
    'noone': 'no one', 'infact': 'in fact', 'neverthless': 'nevertheless',
    'irregardless': 'regardless', 'supposably': 'supposedly',
    'basicly': 'basically', 'prolly': 'probably', 'probly': 'probably',
    'goverment': 'government', 'govermnet': 'government',
    'personel': 'personnel', 'personell': 'personnel',
    'waranty': 'warranty', 'warrantee': 'warranty',
    'priviledge': 'privilege', 'privelege': 'privilege',
    'recomendation': 'recommendation', 'reccommendation': 'recommendation',
    'successfull': 'successful', 'succesfull': 'successful',
    'immediat': 'immediate', 'imediate': 'immediate',
    'excelent': 'excellent', 'excellant': 'excellent',
    'efficent': 'efficient', 'efficiant': 'efficient',
    'consistant': 'consistent', 'consistnet': 'consistent',
    'polution': 'pollution', 'polluton': 'pollution',
    'infomation': 'information', 'informaton': 'information',
    'adress': 'address', 'adres': 'address',
    'develope': 'develop', 'devlop': 'develop',
    'responsable': 'responsible', 'responsibile': 'responsible',
    'availble': 'available', 'avaliable': 'available',
    'diferent': 'different', 'diffrent': 'different',
    'comittee': 'committee', 'commitee': 'committee',
    'unnecesary': 'unnecessary', 'unneccessary': 'unnecessary',
    'beleive': 'believe', 'belive': 'believe',
    'foriegn': 'foreign', 'forein': 'foreign',
    'gaurd': 'guard', 'gard': 'guard',
    'lisence': 'license', 'licence': 'license',
    'paralel': 'parallel', 'parrallel': 'parallel',
    'pharmaseutical': 'pharmaceutical', 'pharmacutical': 'pharmaceutical',
    'posession': 'possession', 'possesion': 'possession',
    'restaraunt': 'restaurant', 'restuarant': 'restaurant',
    'tommorow': 'tomorrow', 'tommorrow': 'tomorrow',
    'wierd': 'weird', 'wired': 'weird',
};

const GRAMMAR_REPLACEMENTS: [RegExp, string][] = [
    [/\btheir is\b/gi, 'there is'],
    [/\btheir are\b/gi, 'there are'],
    [/\btheir was\b/gi, 'there was'],
    [/\btheir were\b/gi, 'there were'],
    [/\bthere ([a-z]+ing)\b/gi, 'their $1'],
    [/\byour ([a-z]+ing)\b/gi, "you're $1"],
    [/\bits a\b/gi, "it's a"],
    [/\bits the\b/gi, "it's the"],
    [/\bits not\b/gi, "it's not"],
    [/\bits been\b/gi, "it's been"],
    [/\bshould of\b/gi, 'should have'],
    [/\bcould of\b/gi, 'could have'],
    [/\bwould of\b/gi, 'would have'],
    [/\bmust of\b/gi, 'must have'],
    [/\bmight of\b/gi, 'might have'],
    [/\ba lot of\b/gi, 'numerous'],
    [/\ba lots of\b/gi, 'numerous'],
    [/\bgonna\b/gi, 'going to'],
    [/\bwanna\b/gi, 'want to'],
    [/\bgotta\b/gi, 'got to'],
    [/\bkinda\b/gi, 'kind of'],
    [/\bsorta\b/gi, 'sort of'],
    [/\bdunno\b/gi, 'do not know'],
    [/\bcuz\b/gi, 'because'],
    [/\bcoz\b/gi, 'because'],
    [/\bbtw\b/gi, 'by the way'],
    [/\basap\b/gi, 'as soon as possible'],
    [/\bpls\b/gi, 'please'],
    [/\bplz\b/gi, 'please'],
    [/\bthx\b/gi, 'thanks'],
    [/\bthnx\b/gi, 'thanks'],
    [/\bu\b/gi, 'you'],
    [/\br\b/gi, 'are'],
    [/\bur\b/gi, 'your'],
    [/\bw\/\b/g, 'with'],
    [/\bw\/o\b/g, 'without'],
    [/\bn\/a\b/gi, 'not applicable'],
    [/\btemp\b/gi, 'temperature'],
    [/\bfridge\b/gi, 'refrigerator'],
    [/\bfood is not\b/gi, 'food items are not'],
    [/\bfoods is\b/gi, 'food items are'],
    [/\bstaffs\b/gi, 'staff members'],
    [/\bwas found that\b/gi, 'has been identified that'],
    [/\bnot good\b/gi, 'unsatisfactory'],
    [/\bvery bad\b/gi, 'critically deficient'],
    [/\breally bad\b/gi, 'severely non-compliant'],
    [/\bpretty bad\b/gi, 'substantially deficient'],
    [/\bnot clean\b/gi, 'inadequately sanitized'],
    [/\bnot working\b/gi, 'non-functional'],
    [/\bnot done\b/gi, 'not completed'],
    [/\bneed to fix\b/gi, 'requires corrective action'],
    [/\bneeds to be fixed\b/gi, 'requires corrective action'],
    [/\bneeds fixing\b/gi, 'requires corrective action'],
    [/\bgot to\b/gi, 'needs to'],
    [/\bhave to\b/gi, 'is required to'],
    [/\bmake sure\b/gi, 'ensure'],
    [/\bget rid of\b/gi, 'eliminate'],
    [/\blook into\b/gi, 'investigate'],
    [/\bcheck out\b/gi, 'inspect'],
    [/\bfind out\b/gi, 'determine'],
    [/\bset up\b/gi, 'establish'],
    [/\bcut down on\b/gi, 'reduce'],
    [/\bgo up\b/gi, 'increase'],
    [/\bgo down\b/gi, 'decrease'],
    [/\bkeep up\b/gi, 'maintain'],
    [/\bput off\b/gi, 'postpone'],
    [/\bcarry out\b/gi, 'execute'],
    [/\bbring up\b/gi, 'raise'],
    [/\bpoint out\b/gi, 'highlight'],
    [/\brun out of\b/gi, 'deplete'],
    [/\bback up\b/gi, 'support'],
    [/\btake care of\b/gi, 'address'],
    [/\bfollow up\b/gi, 'monitor'],
];

const PROFESSIONAL_UPGRADES: [RegExp, string][] = [
    [/\bdirty\b/gi, 'contaminated'],
    [/\bbroken\b/gi, 'damaged'],
    [/\brusty\b/gi, 'corroded'],
    [/\bsmelly\b/gi, 'odorous'],
    [/\brotten\b/gi, 'decomposed'],
    [/\bleaking\b/gi, 'compromised'],
    [/\blazy\b/gi, 'non-diligent'],
    [/\bworker\b/gi, 'staff member'],
    [/\bworkers\b/gi, 'staff members'],
    [/\bguy\b/gi, 'individual'],
    [/\bguys\b/gi, 'personnel'],
    [/\bboss\b/gi, 'supervisor'],
    [/\bstuff\b/gi, 'items'],
    [/\bthings\b/gi, 'items'],
    [/\blacks\b/gi, 'is deficient in'],
    [/\bdue to\b/gi, 'attributed to'],
    [/\bright away\b/gi, 'immediately'],
    [/\bright now\b/gi, 'at this time'],
    [/\ba while ago\b/gi, 'previously'],
    [/\bin spite of\b/gi, 'despite'],
    [/\bin order to\b/gi, 'to'],
    [/\bon top of that\b/gi, 'additionally'],
];

const PASSIVE_VOICE_CONVERSIONS: [RegExp, string][] = [
    [/\b([a-z]+(?:y|ity)) in the\s+([a-z\s]+)\s+(?:was|were) noticed\b/gi, 'The $2 $1'],
    [/\b([a-z]+(?:y|ity)) in the\s+([a-z\s]+)\s+(?:was|were) identified\b/gi, 'The $2 lacked $1'],
    [/\bwas noticed that the\s+([a-z\s]+)\s+([a-z]+(?:ed|ing))\b/gi, 'The $1 was observed to be $2'],
    [/\bwas found that\s+([a-z\s]+)\s+(?:was|were)\s+([a-z]+(?:ed))\b/gi, '$1 was identified as $2'],
    [/\b([a-z\s]+)\s+(?:was|were) not\s+([a-z]+(?:ing|ed))\b/gi, 'The $1 required $2'],
    [/\bwas observed that\s+([a-z\s]+)\s+(?:was|were)\s+([a-z]+)\b/gi, '$1 was found to be $2'],
];

const FOOD_SAFETY_DOMAIN_REWRITES: [RegExp, string][] = [
    [/\binconsistency\s+(?:in|of|within)\s+(?:the\s+)?([a-z\s]+)\s+(?:process|schedule|procedure)(?:\s+was\s+(?:noticed|identified|observed))?\b/gi, 'The $1 showed inconsistencies and lacks proper adherence to protocol'],
    [/\b([a-z\s]+)\s+(?:disinfection|cleaning|sanitation|hygiene)\s+(?:and\s+)?([a-z\s]+)\s+(?:cleaning|disinfection)\s+schedule\s+process\s+was\s+(?:noticed|identified|observed)\b/gi, 'The $1 and $2 cleaning and disinfection schedule was not being followed consistently'],
    [/\b([a-z\s]+)\s+(?:disinfection|cleaning|sanitation)\s+schedule\s+(?:was|were)\s+(?:not\s+)?(?:observed|noticed|identified)\b/gi, 'The $1 disinfection schedule was not being adequately followed'],
    [/\bfailure to\s+([a-z]+)\s+(?:the\s+)?([a-z\s]+)\b/gi, 'Non-compliance: the $2 was not adequately $1'],
    [/\bwas observed that\s+([a-z\s]+)\s+(?:was|were|is|are)\b/gi, 'It was identified that $1'],
    [/\bwas noticed that\b/gi, 'was identified: '],
    [/\bwas found that\b/gi, 'was determined that '],
    [/\bwas observed\b/gi, 'was identified'],
    [/\bwas found\b/gi, 'was identified'],
    [/\bwas noticed\b/gi, 'was identified'],
    [/\bnon[\s-]?compliance\b/gi, 'non-compliance'],
    [/\bwas not\s+([a-z]+(?:ed|ing))\b/gi, 'was insufficiently $1'],
    [/\bremains\b/gi, 'continues to remain'],
    [/\bcorrective\s+action\s+(?:required|needed)\b/gi, 'immediate corrective action required'],
    [/\b([a-z\s]+)\s+was not\s+in\s+(?:good|proper)\s+(?:condition|state)\b/gi, '$1 was non-compliant'],
    [/\b([a-z\s]+)\s+(?:was|were)\s+not\s+(?:properly|adequately)\s+([a-z]+(?:ed|ing))\b/gi, '$1 was inadequately $2'],
];

const SENTENCE_RESTRUCTURING_PATTERNS: [RegExp, string][] = [
    [/\b([a-z\s]+)\s+schedule\s+process\b/gi, 'scheduled process for $1'],
    [/\b([a-z\s]+)\s+(?:and\s+)?([a-z\s]+)\s+(?:cleaning|disinfection)\s+schedule\b/gi, '$1 and $2 cleaning and disinfection schedule'],
    [/\bwas\s+observed\s+(?:that\s+)?(?:the\s+)?([a-z\s]+)\s+was\b/gi, 'was identified: $1 was'],
    [/\b(?:it\s+)?was\s+found\s+(?:that\s+)?(?:the\s+)?([a-z\s]+)\b/gi, '$1 was identified to be'],
];

function preserveMentions(text: string): { cleaned: string; mentions: { ph: string; orig: string }[] } {
    const mentionPattern = /(@\S+|#\S+|\$\S+|\+\S+|\*\S+|!\S+)/g;
    const mentions: { ph: string; orig: string }[] = [];
    const cleaned = text.replace(mentionPattern, (match) => {
        const ph = `__M${mentions.length}__`;
        mentions.push({ ph, orig: match });
        return ph;
    });
    return { cleaned, mentions };
}

function restoreMentions(text: string, mentions: { ph: string; orig: string }[]): string {
    let r = text;
    for (const { ph, orig } of mentions) r = r.replace(ph, orig);
    return r;
}

function fixSpelling(text: string): string {
    return text.replace(/\b(\w+)\b/g, (word) => {
        const lower = word.toLowerCase();
        const fix = SPELLING_MAP[lower];
        if (!fix) return word;
        if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
            return fix.charAt(0).toUpperCase() + fix.slice(1);
        }
        return fix;
    });
}

function applyReplacements(text: string, rules: [RegExp, string][]): string {
    let r = text;
    for (const [pat, rep] of rules) r = r.replace(pat, rep);
    return r;
}

function normalizePunctuation(text: string): string {
    let r = text;
    r = r.replace(/\s{2,}/g, ' ');
    r = r.replace(/\s+([.,;:!?])/g, '$1');
    r = r.replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ');
    r = r.replace(/\bi\b/g, 'I');
    r = r.replace(/\.{2,}/g, '.');
    r = r.replace(/,,+/g, ',');
    r = r.replace(/;;+/g, ';');
    return r;
}

function capitalizeSentences(text: string): string {
    return text.replace(/(^|[.!?]\s+)([a-z_])/g, (match, pre, letter) => {
        if (letter === '_') return match;
        return pre + letter.toUpperCase();
    });
}

function ensureEndPunctuation(text: string): string {
    const t = text.trim();
    if (!t) return t;
    if (['.', '!', '?'].includes(t.slice(-1))) return t;
    return t + '.';
}

function splitSentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

function rebuildSentences(text: string): string {
    const sents = splitSentences(text);
    if (sents.length === 0) {
        let r = text.trim();
        if (!r) return r;
        r = r.charAt(0).toUpperCase() + r.slice(1);
        return ensureEndPunctuation(r);
    }
    return sents.map(s => {
        let t = s.trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (!['.', '!', '?'].includes(t.slice(-1))) t += '.';
        return t;
    }).join(' ');
}

function buildCorrected(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    return rebuildSentences(r);
}

function buildProfessional(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = applyReplacements(r, PROFESSIONAL_UPGRADES);
    r = applyReplacements(r, FOOD_SAFETY_DOMAIN_REWRITES);
    r = applyReplacements(r, PASSIVE_VOICE_CONVERSIONS);
    r = applyReplacements(r, SENTENCE_RESTRUCTURING_PATTERNS);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    return rebuildSentences(r);
}

function buildConcise(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = applyReplacements(r, FOOD_SAFETY_DOMAIN_REWRITES);
    r = applyReplacements(r, PASSIVE_VOICE_CONVERSIONS);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    const sents = splitSentences(r);
    if (sents.length <= 1) return rebuildSentences(r);
    return sents.map(s => {
        let t = s.trim();
        t = t.replace(/\s*(however|therefore|additionally|furthermore|moreover|consequently)\s*/gi, ' ');
        t = t.replace(/\s{2,}/g, ' ').trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (!['.', '!', '?'].includes(t.slice(-1))) t += '.';
        return t;
    }).join(' ');
}

export type RewriteOption = { label: string; text: string; icon: string };

export function offlineRewriteMulti(text: string): RewriteOption[] {
    if (!text.trim()) return [];
    const { cleaned, mentions } = preserveMentions(text);
    const corrected = restoreMentions(buildCorrected(cleaned), mentions);
    const professional = restoreMentions(buildProfessional(cleaned), mentions);
    const concise = restoreMentions(buildConcise(cleaned), mentions);
    return [
        { label: 'Corrected', text: corrected, icon: '✅' },
        { label: 'Professional', text: professional, icon: '✨' },
        { label: 'Concise', text: concise, icon: '⚡' },
    ];
}

let puterLoadPromise: Promise<void> | null = null;

export function loadPuterJs(): Promise<void> {
    if (puterLoadPromise) return puterLoadPromise;
    puterLoadPromise = new Promise((resolve, reject) => {
        if ((window as any).puter?.ai) { resolve(); return; }
        const waitForReady = () => {
            let interval: ReturnType<typeof setInterval>;
            let timeout: ReturnType<typeof setTimeout>;
            timeout = setTimeout(() => { clearInterval(interval); puterLoadPromise = null; reject(new Error('timeout')); }, 8000);
            interval = setInterval(() => {
                if ((window as any).puter?.ai) { clearInterval(interval); clearTimeout(timeout); resolve(); }
            }, 200);
        };
        const existing = document.querySelector('script[src*="js.puter.com"]');
        if (existing) { waitForReady(); return; }
        const script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.onload = () => waitForReady();
        script.onerror = () => { puterLoadPromise = null; reject(new Error('load_failed')); };
        document.head.appendChild(script);
    });
    return puterLoadPromise;
}

export async function tryPuterRewrite(text: string): Promise<RewriteOption[] | null> {
    try {
        await loadPuterJs();
        const puter = (window as any).puter;
        if (!puter?.ai?.chat) return null;

        const prompt = `You are a food safety observation report editor. Your ONLY job is to fix and rephrase the given text.

STRICT RULES:
- Fix ALL spelling, grammar, and punctuation errors
- Do NOT add new sentences, details, recommendations, or conclusions
- Do NOT add phrases like "poses a risk", "corrective action needed", "ensure compliance"
- Keep the SAME meaning and approximately the SAME number of sentences
- Output must be valid JSON only — no markdown, no code blocks, no explanation

Return this exact JSON structure:
{"options":[{"label":"Corrected","text":"..."},{"label":"Professional","text":"..."},{"label":"Concise","text":"..."}]}

Styles:
1. "Corrected" — fix spelling and grammar only, keep the original wording as close as possible
2. "Professional" — same meaning rewritten in formal food safety audit language
3. "Concise" — same meaning in fewer words, tight and direct

Text to rewrite:
${text}`;

        const chatPromise = puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('puter_timeout')), 20000));
        const response = await Promise.race([chatPromise, timeoutPromise]) as any;
        const raw = typeof response === 'string' ? response : response?.message?.content || response?.text || '';
        if (!raw) return null;

        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*"options"[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];

        const parsed = JSON.parse(cleaned);
        if (parsed.options?.length) {
            const icons = ['✅', '✨', '⚡'];
            return parsed.options.map((opt: any, i: number) => ({
                label: opt.label || `Option ${i + 1}`,
                text: opt.text,
                icon: icons[i] || '📝',
            }));
        }
    } catch (e) {
        console.warn('Puter AI rewrite failed:', e);
    }
    return null;
}

export async function generateRewriteOptions(text: string): Promise<RewriteOption[]> {
    if (!text.trim()) return [];

    const puterResult = await tryPuterRewrite(text);
    if (puterResult) return puterResult;

    try {
        const res = await fetch('/api/rewrite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.options?.length) {
                const icons = ['✅', '✨', '⚡'];
                return data.options.map((opt: any, i: number) => ({
                    label: opt.label || `Option ${i + 1}`,
                    text: opt.text,
                    icon: icons[i] || '📝',
                }));
            }
        }
        throw new Error('fallback');
    } catch {
        const options = offlineRewriteMulti(text);
        return options.length > 0 ? options : [{ label: 'Corrected', text: text.trim(), icon: '✅' }];
    }
}

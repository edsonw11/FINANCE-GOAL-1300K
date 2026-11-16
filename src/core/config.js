/**
 * core/config.js
 * Responsibility: Static constants and catalogs (storage key, palette, month names, default and suggested categories).
 */
export const STORAGE_KEY='metaapp.v2';
export const COLORS=['--c0','--c1','--c2','--c3','--c4','--c5','--c6','--c7','--c8','--c9','--c10','--c11'];
export const MONTH_NAMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const DEFAULT_CATEGORIES={despesa:{'Moradia':'🏠','Mercado':'🛒','Transporte':'🚗','Saúde':'💊','Lazer':'🎬','Restaurantes':'🍽️','Alimentação (outros)':'🥐','Educação':'📚','Luz':'💡','Água':'💧','Internet':'🌐','Telefone':'📱','Gás':'🔥','Assinaturas':'📺','Cartão de crédito':'💳','Viagem':'✈️','Imprevistos / Outros':'⚠️'},
            receita:{'Salário':'💼','VR/VA (benefício)':'🍴','Freelance':'🧑‍💻','Rendimentos':'📈','Renda Extra':'➕','Serviços':'🛠️','Outros':'💰'}};
// expense groups: each category belongs to one group (Luz, Água, Gás... are part of Moradia).
// [group, icon, default categories]; the user can move categories and create groups.
export const DEFAULT_GROUPS=[
  ['Moradia','🏠',['Moradia','Aluguel','Condomínio','Luz','Água','Gás','Internet','Telefone','IPTU','Manutenção da casa']],
  ['Alimentação','🍽️',['Mercado','Restaurantes','Alimentação (outros)']],
  ['Transporte','🚗',['Transporte','Combustível','Uber e transporte por app','Veículo (manutenção e seguro)','IPVA e licenciamento','Estacionamento e pedágio']],
  ['Saúde','💊',['Saúde','Plano de saúde','Farmácia','Consultas e exames','Academia','Cuidados pessoais']],
  ['Lazer e compras','🎬',['Lazer','Viagem','Roupas e calçados','Eletrônicos e casa','Presentes e doações']],
  ['Educação','📚',['Educação','Cursos e idiomas']],
  ['Família','🍼',['Filhos e bebê']],
  ['Financeiro e impostos','🏦',['Tarifas bancárias e juros','Imposto de renda e taxas','Financiamentos e empréstimos','Cartão de crédito']]];
// a new category whose name matches is placed in that group (first match wins)
export const GROUP_KEYWORDS=[
  ['Saúde',/academia|wellhub|gympass|smart ?fit|muscula|pilates|crossfit|farm[aá]cia|drogaria|m[eé]dic|dentist|odonto|consulta|exame|plano de sa|conv[eê]nio|sa[uú]de|terapia|psic|hospital|cl[ií]nica|fisio|nutri/i],
  ['Transporte',/uber|\b99\b|t[aá]xi|combust|gasolina|etanol|transporte|[oô]nibus|metr[oô]|estacion|ped[aá]gio|ipva|ve[ií]culo|carro|moto\b|oficina/i],
  ['Moradia',/alug|condom|\bluz\b|energia|[aá]gua|\bg[aá]s\b|internet|telefone|celular|iptu|\bcasa\b|moradia|reforma|faxina|diarista/i],
  ['Alimentação',/mercado|supermerc|restaurante|ifood|delivery|padaria|feira|a[cç]ougue|aliment|lanche|caf[eé]/i],
  ['Educação',/escola|faculdade|curso|idioma|livro|educa/i],
  ['Família',/filho|beb[eê]|creche|fralda|pet|veterin/i],
  ['Lazer e compras',/lazer|cinema|viagem|hotel|roupa|cal[cç]ado|presente|show|bar\b/i],
  ['Financeiro e impostos',/tarifa|juros|imposto|taxa|financiamento|empr[eé]stimo|iof/i]];
export const LEG={'Contas (luz, água, net)':'💡'};
export const SUGGESTED_CATEGORIES=[
 ['Casa',[['Manutenção da casa','🔧',1],['IPTU','🏛️',0]]],
 ['Transporte',[['Combustível','⛽',1],['Uber e transporte por app','🚕',1],['Veículo (manutenção e seguro)','🛠️',1],['IPVA e licenciamento','📄',1],['Estacionamento e pedágio','🅿️',1]]],
 ['Saúde e cuidados',[['Plano de saúde','🏥',1],['Farmácia','💊',1],['Consultas e exames','🩺',1],['Academia','🏋️',1],['Cuidados pessoais','💈',1]]],
 ['Família',[['Filhos e bebê','🍼',1]]],
 ['Educação',[['Cursos e idiomas','🎓',0]]],
 ['Lazer e compras',[['Roupas e calçados','👕',1],['Eletrônicos e casa','🖥️',1],['Presentes e doações','🎁',1]]],
 ['Financeiro e impostos',[['Tarifas bancárias e juros','🏦',1],['Imposto de renda e taxas','🧾',1],['Financiamentos e empréstimos','📉',0]]]];

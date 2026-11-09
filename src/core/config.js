/**
 * core/config.js
 * Responsibility: Static constants and catalogs (storage key, palette, month names, default and suggested categories).
 */
const STORAGE_KEY='metaapp.v2';
const COLORS=['--c0','--c1','--c2','--c3','--c4','--c5','--c6','--c7'];
const MONTH_NAMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DEFAULT_CATEGORIES={despesa:{'Moradia':'🏠','Mercado':'🛒','Transporte':'🚗','Saúde':'💊','Lazer':'🎬','Restaurantes':'🍽️','Alimentação (outros)':'🥐','Educação':'📚','Luz':'💡','Água':'💧','Internet':'🌐','Telefone':'📱','Gás':'🔥','Assinaturas':'📺','Cartão de crédito':'💳','Viagem':'✈️','Imprevistos / Outros':'⚠️'},
            receita:{'Salário':'💼','VR/VA (benefício)':'🍴','Freelance':'🧑‍💻','Rendimentos':'📈','Renda Extra':'➕','Serviços':'🛠️','Outros':'💰'}};
const LEG={'Contas (luz, água, net)':'💡'};
const SUGGESTED_CATEGORIES=[
 ['Casa',[['Manutenção da casa','🔧',1],['IPTU','🏛️',0]]],
 ['Transporte',[['Combustível','⛽',1],['Uber e transporte por app','🚕',1],['Veículo (manutenção e seguro)','🛠️',1],['IPVA e licenciamento','📄',1],['Estacionamento e pedágio','🅿️',1]]],
 ['Saúde e cuidados',[['Plano de saúde','🏥',1],['Farmácia','💊',1],['Consultas e exames','🩺',1],['Academia','🏋️',1],['Cuidados pessoais','💈',1]]],
 ['Família',[['Filhos e bebê','🍼',1]]],
 ['Educação',[['Cursos e idiomas','🎓',0]]],
 ['Lazer e compras',[['Roupas e calçados','👕',1],['Eletrônicos e casa','🖥️',1],['Presentes e doações','🎁',1]]],
 ['Financeiro e impostos',[['Tarifas bancárias e juros','🏦',1],['Imposto de renda e taxas','🧾',1],['Financiamentos e empréstimos','📉',0]]]];

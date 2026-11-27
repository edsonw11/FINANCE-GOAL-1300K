# Pesquisa de mercado: relatório consolidado

Data de acesso das fontes: 2026-11-27. Quatro relatórios brutos, com fontes, URLs, datas e limitações, estão em `raw/`:
[A (apps brasileiros)](raw/A-brasil-apps.md) · [B (apps internacionais)](raw/B-internacional-apps.md) · [C (mercado brasileiro)](raw/C-mercado-brasileiro.md) · [D (comportamento e ideias)](raw/D-comportamento-e-ideias.md).
Este arquivo resume e decide; os números e citações só valem com a fonte do relatório bruto.

Tags: [OFICIAL] página ou documento do próprio fornecedor ou órgão; [USUÁRIO] relato ou avaliação de usuário; [TERCEIRO] blog ou comparativo; [HIPÓTESE] inferência nossa. Frequências só com os rótulos: Recorrente na amostra analisada, Encontrado em alguns relatos, Relato isolado, Não foi possível determinar.

## 0. Metodologia e limites (leia antes das conclusões)

| Item | O que foi feito de verdade |
|---|---|
| Apps | A fundo: Mobills, Organizze, Minhas Economias, Meu Dinheiro Web, Kinvo, Pierre (BR); YNAB, Monarch, Copilot, Wallet, Spendee, Monefy, Money Manager, Toshl, Actual Budget, Firefly III, Lunch Money, Bluecoins, PocketGuard, Rocket Money, Empower, Cleo (exterior). Olivia e Guiabolso: só histórico (encerrados em 2022). |
| Lojas | App Store: lida pela API pública de avaliações (cerca de 88 avaliações BR lidas em A; cerca de 1.100 carregadas em B, excertos de cerca de 280 lidos, a maioria de 1 a 3 estrelas, EUA e Brasil). **Google Play: bloqueado (HTTP 403); só trechos da busca.** |
| Outras fontes | Reclame Aqui: cerca de 116 trechos (em A) e cerca de 20 (em D), vindos do buscador, não das páginas completas. Fóruns e blogs: algumas dezenas de páginas. Fontes oficiais (Serasa, CNC, Open Finance Brasil, B3): trechos. |
| **Reddit** | **0 threads lidas.** Acesso bloqueado e a busca não devolveu URLs. A pesquisa pedia Reddit; isso não foi cumprido. |
| Período | Avaliações da App Store vieram sem data em A; podem refletir versões antigas. Em B há datas. |
| Vieses | Reclame Aqui e avaliações negativas têm viés de seleção: não dão proporção. As notas da amostra de B não são a nota da loja. |
| Nenhum app foi instalado | Onboarding e facilidade de uso vêm de relatos e documentação, **não de teste nosso**. |

Consequência: as conclusões abaixo são **indícios fortes em alguns pontos e hipóteses em outros**. Onde é hipótese, está escrito.

## 1. Respostas às 12 perguntas

**1. Cinco problemas mais relevantes que usuários enfrentam (na amostra)**
1. Sincronização/integração bancária que quebra, atrasa, duplica ou perde histórico. Recorrente na amostra analisada (A, B, D). [USUÁRIO]
2. Cobrança, renovação e cancelamento difíceis, e recursos essenciais atrás de plano pago. Recorrente (A: Mobills, Organizze; B: Monarch, Rocket Money, Cleo). [USUÁRIO]
3. Perda ou corrupção de dados após atualização ou migração. Recorrente em Minhas Economias (nova versão 2026); em alguns relatos em Mobills, Spendee, Monefy, Bluecoins. [USUÁRIO]
4. Dados importados errados: parcelas de fatura, duplicidades, categoria errada. Em alguns relatos (Organizze após Open Finance, Mobills). [USUÁRIO]
5. Apps estrangeiros que não servem ao Brasil (idioma, bancos, preço em dólar). Encontrado em alguns relatos; para Copilot é oficial ("available in the US"). [OFICIAL]/[USUÁRIO]
Observação: "cansaço de lançar à mão" é muito citado em blogs e marketing, mas **quase não aparece em relatos diretos**. Fica como [HIPÓTESE] plausível, não como fato medido (D).

**2. Mais reclamado nas lojas:** sincronização/Open Finance e cobrança/cancelamento (A, B). Com viés de seleção.

**3. Mais elogiado:** interface simples e rápida (Organizze, na App Store), importação com um clique, captura por notificação/SMS no Android, teste sem cartão (A). Em D, o que parece valorizado é confiança nos números, pouco esforço recorrente com decisão final do usuário, e cobrança transparente. A parte de D é interpretação, [HIPÓTESE].

**4. O que nosso app já resolve** (verificado nos módulos e nos testes; ver matriz na seção 3): importação de OFX, CSV e PDF com revisão em lote; duplicados; parcelas; transferências entre contas próprias; sugestão de categoria pelo histórico; entrada por frase; faturas de cartão; orçamentos; patrimônio e meta; funciona offline e sem assinatura.

**5. O que ainda não resolvemos:** captura automática (Open Finance, notificação, SMS); nenhum Android/iOS em loja com onboarding validado por terceiros; categorização que aprende por regras com limiar de confiança; fila "só confirmar" desde a abertura do app (hoje a revisão acontece dentro da importação); suporte multiusuário/família (não pesquisado com fonte, [HIPÓTESE]).

**6. O que concorrentes fazem melhor:** sincronização automática (quando funciona) e captura por notificação (Mobills, Organizze, lifin.pro [OFICIAL] marketing); Meu Dinheiro Web importa mais formatos (QIF, XLS, OFC) [OFICIAL]; Monarch tem "Needs review" com regras e Copilot aplica categoria só com confiança alta e mostra as duas melhores sugestões [OFICIAL] (ajuda e blog).

**7. Onde concorrentes deixam usuários insatisfeitos:** ver item 1. Em especial, a conexão bancária é vendida como diferencial e é a maior fonte de queixa (Mobills, Organizze, Kinvo/B3). O plano vitalício do Organizze não inclui a conexão bancária e isso gera revolta [USUÁRIO].

**8. Oportunidade de maior potencial (hipótese ranqueada):** ver seção 4.

**9. Foco principal sugerido:** **"Importar e confirmar": transformar o extrato (que o usuário já tem, sem Open Finance, sem assinatura) numa fila curta de confirmação que o app já deixa 90% resolvida.** Justificativa e riscos na seção 4. É uma recomendação com base em evidência parcial; peço sua decisão antes de construir.

**10. Experiência radicalmente mais simples:** ver seção 5.

**11. MVP:** seção 6.

**12. O que não construir:** seção 7.

## 2. Matriz de concorrentes (resumo; detalhes e fontes nos relatórios brutos)

| App | Origem | Entrada de dados | Conexão bancária | Importação | Brasil | Queixa principal (rótulo) |
|---|---|---|---|---|---|---|
| Mobills | BR | manual, notificação/SMS | Open Finance (pago) | OFX com limites (A, C) | sim | Open Finance e cobrança (Recorrente) |
| Organizze | BR | manual, notificação | Open Finance (pago) | sim | sim | sync, cobrança, suporte (Recorrente no RA); loja elogia |
| Minhas Economias | BR | manual, sync | sim | — | sim | nova versão 2026 perdeu histórico (Recorrente) |
| Meu Dinheiro Web | BR | manual | — | OFX/OFC, XLS, CSV, QIF, PDF [OFICIAL] | sim | amostra fraca (Não foi possível determinar) |
| Kinvo | BR | B3 | B3/Open Finance | — | sim | sync com B3 (Recorrente) |
| YNAB | EUA | manual/sync | EUA | OFX/CSV/QFX/QIF só web | não atende | preço, sem bancos BR |
| Monarch / Copilot / Empower | EUA | sync (Plaid) | EUA | — | não atendem (Copilot oficial) | assinatura (Monarch) |
| Wallet / Spendee / Toshl | UE | manual + sync | instável no BR (relatos) | — | interface em português | sync instável (Encontrado em alguns relatos) |
| Monefy / Money Manager | — | só manual | não | — | português | simples; perda de dados em alguns relatos |
| Actual Budget | open source | manual/sync | Pluggy (BR) experimental [OFICIAL] | OFX/CSV | via Pluggy | setup pesado |

Lacunas: transferências entre contas próprias (Monarch, Copilot, Wallet, Monefy, Money Manager) e formato de importação do Wallet e do Money Manager: Não foi possível determinar. Nenhum app com importação de PDF nas fontes lidas, exceto Meu Dinheiro Web [OFICIAL].

## 3. Matriz de problemas e comparação com o nosso app

"Verificado" = li o módulo que implementa (cabeçalho e código) e existe teste unitário e/ou e2e no projeto. **Não significa que um usuário real validou.** A classificação é crítica de propósito.

| Necessidade | Concorrentes (como) | Nosso app (evidência no código) | Classificação | Lacuna |
|---|---|---|---|---|
| Lançamento rápido | Todos: formulário; alguns com notificação/SMS | Entrada por frase em português com regras fixas (`quick-entry.js`), sugestão de categoria ao digitar (`transaction-suggest.js`), padrões da última entrada (`entry-defaults.js`) | Já resolvido (manual) | sem captura automática |
| Transferências próprias | Mobills e Controle Ágil: ação manual do usuário (C); outros: Não foi possível determinar | Reconhece Pix/TED para o próprio nome e tira do mês; casa os dois lados em bancos diferentes; corrige registros antigos (`own-names.js`, `transfers.js`, `saved-transfers.js`) | Já resolvido; **à frente do que as fontes mostram dos concorrentes** | depende de o usuário informar o nome; teste com extratos reais anonimizados pendente |
| Importação de extratos | Mobills (OFX com limites), Meu Dinheiro (muitos formatos) | OFX, CSV com mapeamento de colunas, PDF digital (Santander, Bradesco, Nubank), revisão em lote, duplicados confirmados/possíveis, parcelas (`import-*.js`) | Já resolvido para os formatos suportados | PDF é "genérico e aproximado" (próprio cabeçalho); formatos de Inter, C6, Caixa sem confirmação (C); QIF/XLS ausentes |
| Vários bancos | Open Finance (frequentemente quebra) | Contas e extratos importados de qualquer banco; consolidação de patrimônio | Parcialmente: consolida o que o usuário importa; **sem atualização automática** | importar é um ato manual recorrente |
| Classificação automática | Copilot/Monarch: confiança e regras | Sugere categoria pelo histórico da descrição (`import-history.js`), mas só sugere; sem regras salvas nem limiar de confiança | Parcialmente | regras que aprendem |
| Revisão / caixa de entrada | Monarch "Needs review", Fina, lifin.pro | A revisão existe só dentro do fluxo de importação (cartões de rascunho, marcar todos) | Parcialmente | fila persistente e de um toque |
| Investimentos | Kinvo (B3), outros | Aportes, saldos digitados, nota de corretagem B3, extrato de custódia, carteira, meta (`investments.js`, `brokerage-note.js`, `import-custody.js`) | Já resolvido para acompanhar patrimônio; **reinvestimento de CDB estava errado e foi corrigido hoje** | sem integração B3 |
| Recorrências | Mobills, Organizze | Série "Todo mês · Nx" e contas do mês (`monthly-bills.js`) | Já resolvido | — |
| Cartão e parcelamento | Mobills/Organizze (parcelas futuras com defeito em Open Finance, A/C) | Faturas por ciclo, parcelas, pagamento de fatura (`card-*.js`, `invoice-payment.js`) | Já resolvido (manual/importado) | — |
| Conexão bancária / Open Finance | Mobills, Organizze, Actual (Pluggy) | **Nenhuma** (busca no código: 0 ocorrências) | Não resolvido | decisão estratégica, ver seção 4 |
| Captura por notificação/SMS | Mobills, Organizze, lifin.pro | Nenhuma | Não resolvido | só no Android; ver riscos |
| Multi-dispositivo | Todos | Sync próprio com backend e app Android (Capacitor) | Parcialmente: construído, sem uso real validado | — |
| Exportar e cancelar | queixas de cancelamento difícil | Dados locais, backup e relatório; sem assinatura | Já resolvido | — |
| Contas de familiares | Não foi possível determinar (C: sem fonte) | Não verificado | Não aplicável até haver evidência | pesquisar |

Funcionalidades que existem mas são difíceis de achar: não medi com usuários. **Hipótese a testar:** orçamentos, "o que fazer agora", contas do mês e relatórios competem na mesma tela; o app tem 58 módulos de domínio e dezenas de telas, o que pede simplificação e não mais recursos (critério 10 do prompt).

## 4. Oportunidades ranqueadas (cada uma com a força da evidência)

| # | Oportunidade | Evidência a favor | Evidência contra / limite | Força |
|---|---|---|---|---|
| 1 | **Importar extrato + fila de confirmação** (sem Open Finance, sem assinatura) | Open Finance é a maior fonte de queixa (A, B, D); a necessidade de decidir o resultado final é forte: 87% querem sugestão e decisão própria, 13% tudo manual, ninguém delega 100% [pesquisa ilegra/InfoMoney 14/08/2026, conteúdo de mercado, fonte secundária] | Importar à mão é esforço recorrente; usuários que querem "automático" vão preferir Mobills/Organizze; zero relato de usuário avaliando a fila em si (D: Não foi possível determinar) | **Média**: boa lógica, evidência direta fraca |
| 2 | Casar transferências próprias e Pix opaco | Dupla contagem existe (Goodbudget, C); concorrentes tratam como ação manual | Poucas fontes; nós já fazemos | Média; **já é vantagem, vale destacar** |
| 3 | Mostrar parcelas futuras corretas | Organizze documenta que Open Finance não traz parcelas futuras [OFICIAL] | Só um app citado | Média-baixa |
| 4 | Importação robusta (OFX/CSV/PDF por banco) como alternativa ao Open Finance | C: nenhum app cobre PDF; Meu Dinheiro cobre vários | Parsers por banco dão manutenção contínua; sem OFX real de cada banco (C recomenda coletar) | Média |
| 5 | Regras que aprendem com limiar de confiança | Copilot e Monarch fazem; categoria errada aparece nas queixas | Não é diferencial, é "esperado" | Média; é básico, não diferencial |
| 6 | Linguagem natural, QR de NFC-e, captura de Pix | Existem produtos | Sem relato de usuário nem prova de retenção (D) | Baixa: "parece inovador, sem evidência" |
| 7 | Reinvestimento e renda fixa tratados corretamente | Kinvo não sincroniza resgate total; B3 só mostra CDB se a instituição registra (C) | CDB reinvestido confundindo apps é só hipótese (sem fonte) | Baixa-média; nasceu de um bug real nosso |

**Crítica ao que você propôs no prompt:** a ideia "o app entende e pede só a confirmação" já está **em grande parte construída** dentro da importação. O que falta não é inteligência nova, e sim (a) tornar isso o fluxo principal em vez de um recurso escondido numa folha, e (b) cortar o resto. E a evidência de que isso vira retenção é fraca. Eu não afirmo que seja disruptivo.

## 5. Experiência ideal e jornada

Hoje (hipótese baseada nos módulos; **não cronometrei um usuário**): abrir o app, achar Importar, escolher arquivo, mapear colunas se for CSV, revisar cartão por cartão, confirmar; no resto do tempo, lançar à mão.

Proposta:
1. Abertura mostra uma única pergunta: "Você tem extrato novo?" (arrastar/escolher arquivo ou compartilhar do app do banco).
2. O app devolve **uma lista já resolvida** (categoria pelo histórico, transferências próprias fora, duplicados fora, parcelas reconhecidas) e destaca só o que está incerto.
3. Um toque confirma tudo; só os itens incertos pedem decisão.
4. O resultado atualiza Investido, Sobrou e patrimônio, e o app diz o que mudou.

Meta mensurável (a validar): de vários minutos para poucos toques por extrato. Hoje não temos o "antes" medido.

## 6. MVP e priorização

| P | Item | Observação |
|---|---|---|
| P0 | Validar com 3 a 5 extratos reais anonimizados por banco (Nubank, Itaú, Inter, C6, Santander, Bradesco) o quanto de cada extrato chega resolvido | Sem isso, qualquer promessa é chute (C recomenda o mesmo) |
| P0 | Medir o "antes": tempo e toques para importar um mês | Linha de base para as métricas |
| P1 | Fila "a confirmar" na abertura, com resolvidos agrupados e incertos destacados | Reaproveita `import-draft`/`import-history` |
| P1 | Regras salvas ("sempre que for X, categoria Y") com limiar de confiança | Básico esperado |
| P2 | Captura por notificação no Android | Depende de modelo de cada banco; iOS limita (Mobills admite) |
| — | Open Finance | Fora do produto por decisão do proprietário (2026-11-27) |
| P2 | Simplificar telas: esconder o que não for do fluxo principal | Critério 10 |

## 7. O que não construir (por enquanto)

- Open Finance próprio: queixa nº 1 dos concorrentes, custo para app pequeno Não foi possível determinar, consentimento de até 12 meses [OFICIAL].
- Linguagem natural mais esperta, IA em todas as telas, QR de nota fiscal: sem evidência de problema importante.
- Mais gráficos, mais telas de relatório.
- Assinatura. A cobrança é queixa recorrente; hoje não cobramos.

## 8. Riscos

- **Técnicos:** parsers de PDF por banco quebram quando o banco muda o layout; formatos de Inter, C6 e Caixa não confirmados; notificação depende do Android; reconhecimento de transferência depende do nome informado.
- **Financeiros/dados:** nenhuma ação automática deve gravar sem confirmação; erro de classificação muda totais (mesmo cuidado que a correção de hoje do reinvestimento).
- **Pesquisa:** Reddit e Google Play não foram lidos; o estudo precisa ser refeito nesses pontos antes de decisões caras.
- **Produto:** este é um app pessoal; não validamos que outras pessoas o queiram.

## 9. Métricas para medir a melhoria (a definir a linha de base primeiro)

- Toques e segundos para importar um mês de extrato (antes/depois).
- Percentual de linhas que chegam resolvidas (sem edição) por banco, em extratos anonimizados reais.
- Percentual de itens incertos corrigidos pelo usuário (taxa de erro da sugestão).
- Dias entre importações (hábito) e meses seguidos com fechamento feito.
- Erros de dupla contagem relatados (meta: zero).

## 10. Limitações e próximos passos da pesquisa

1. Ler Reddit e fóruns por outro caminho; ler Google Play; ler Reclame Aqui completo.
2. Instalar 2 ou 3 concorrentes e **cronometrar o onboarding**.
3. Obter o relatório original da pesquisa ilegra/InfoMoney (hoje só secundário) e o PDF de Fogarty (CHI 2016).
4. Coletar extratos reais anonimizados por banco.
5. Preços de Mobills, Minhas Economias, Meu Dinheiro, Kinvo: sem fonte oficial atual.

## 11. Decisões que dependem de você

1. Confirmar o foco: "Importar e confirmar" como fluxo principal.
2. Autorizar a coleta de extratos anônimos seus (você mesmo) para medir o P0.
3. Aprovar fazer uma segunda rodada de pesquisa cobrindo Reddit e Play antes de construir.

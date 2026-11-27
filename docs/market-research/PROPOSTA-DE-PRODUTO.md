# Proposta de produto: um app que trabalha para o usuário

Segunda etapa, a partir da diretriz estratégica. **Nada foi implementado nem alterado no código.** Evidências de mercado: [RELATORIO.md](RELATORIO.md) e `raw/`. Aqui, "verificado" = li o módulo no código; **não significa que rodei o seu cenário real nem que usuário validou.** [HIPÓTESE] = inferência nossa.

## 1. O seu cenário real contra o app de hoje

Os 7 problemas que você descreveu, um a um:

| # | Problema | O que o código faz hoje (verificado) | Situação |
|---|---|---|---|
| 1 | Mesmo dinheiro passa por vários bancos | Cada extrato é importado por conta; o patrimônio soma as contas | Parcial: depende de importar cada banco à mão |
| 2 | Transferência entre contas próprias não é receita nem despesa | Reconhece Pix/TED com o seu nome e guarda como transferência; casa o outro lado no extrato do outro banco (mesmo valor, sentido oposto, poucos dias); corrige registros antigos (`own-names`, `transfers`, `saved-transfers`) | Resolvido, **com uma condição**: o app precisa saber o seu nome como o banco o imprime |
| 3 | Dinheiro administrado para terceiros (Itaú da sua mãe, aluguel de ~R$ 750, plano de saúde ~R$ 426) | **Não existe o conceito.** Busca por "terceiro/on behalf" em `src/`: 0 ocorrências. A transferência para a conta da sua mãe não tem o seu nome, então cairia como despesa; a despesa do plano de saúde dela entraria como sua | **Não resolvido**; é a lacuna mais específica do seu cenário |
| 4 | Investimentos e resgates não são receita/despesa | Resgate/saque/retirada com entrada vira "não importável" com aviso; saída com palavra de investimento vira aporte "para conferir"; extrato de investimento: entrada é aporte (`import-classify`) | Parcial: regras por palavras. O aviso existe, mas **resgate de CDB do Inter para outra conta seu não é casado com a entrada na outra conta** (não verificado em extrato real) |
| 5 | Cartões, faturas, parcelas sem duplicar | Pagamento de fatura é tratado à parte (não vira despesa duas vezes), parcelas lidas ("PARC 03/10"), faturas por ciclo | Resolvido para o que é importado/digitado |
| 6 | Não cadastrar a mesma coisa em vários lugares | Entrada única; sugestão pelo histórico; sem captura automática | Parcial |
| 7 | Entender contexto, não só palavras | Classificação por palavras e expressões regulares; flags de incerteza (`maybe-transfer`, `installment-unsure`, `check-aporte`, `possible-transfer`) | Parcial: **já avisa quando não tem certeza**, mas não explica por quê com o histórico nem aprende por regra |

Você pediu para não fazer regra específica para as suas contas. Concordo, e o cenário se reduz a **três ideias gerais** (seção 3): conta de terceiros, transferência por par de movimentos (não por nome), e fila única de pendências.

## 2. Respostas às 7 perguntas da diretriz

**1. Maior problema que os apps ainda não resolvem bem.** Na amostra pesquisada, o dado chega **errado ou atrasado** (sync/Open Finance duplica, perde histórico, não traz parcelas futuras) e o usuário passa a trabalhar para o app. Os apps que automatizam trocam um trabalho (digitar) por outro (consertar). [USUÁRIO], limites no relatório (Reddit e Google Play não lidos). Nenhuma fonte lida cobre **dinheiro de terceiros**: Não foi possível determinar se algum concorrente resolve; trate como espaço aberto, não como fato.

**2. Maiores oportunidades.** Seção 3.

**3. Reduzir lançamentos e ajustes manuais.** Hoje o esforço se divide em: digitar, importar, revisar, corrigir. Proponho **eliminar a digitação do que pode ser lido e a revisão do que é certo**: (a) importar vários extratos de uma vez, (b) resolver sozinho o que tem certeza alta e mostrar o que o app já resolveu, (c) só perguntar o que realmente é ambíguo, em lote.

**4. App como assistente que trabalha continuamente.** Sem Open Finance, o app só "trabalha" quando recebe arquivo. Opção realista: tornar o ato de importar quase sem atrito (compartilhar o arquivo do app do banco para o app; abrir pasta; arrastar vários). Captura por notificação (Android) é uma segunda etapa. Open Finance fica fora (custo e confiabilidade, ver seção 6).

**5. Manter, simplificar, reformular ou remover.** Seção 5.

**6. Experiência ideal para quem nunca usou app financeiro.** Seção 4.

**7. Menor conjunto de mudanças para uma experiência superior.** Seção 7 (curto prazo).

## 3. Oportunidades (formato pedido na diretriz)

### O1. Fila única "Precisa de você" (importar e confirmar)
| Critério | Avaliação |
|---|---|
| Problema | Revisar linha por linha é trabalho; o usuário abandona quando o resultado exige conserto |
| Evidência | Queixas de dado errado após sync [USUÁRIO]; pesquisa brasileira: 87% querem sugestão com decisão própria, 13% tudo manual, ninguém delega 100% (ilegra/InfoMoney, 14/08/2026, fonte secundária); Monarch "Needs review", Copilot só aplica com confiança alta [OFICIAL]. **Nenhum relato de usuário avaliando a fila**: Não foi possível determinar |
| Solução | Depois de importar, mostrar 3 blocos: "Resolvido pelo app" (colapsado, com motivo), "Pergunta rápida" (poucas linhas incertas, uma decisão por linha, com a razão) e "Não contei" (transferências, fatura, resgate). Confirmar tudo em um toque |
| Diferencial | O app já classifica e sinaliza incerteza; falta torná-la a tela principal e mostrar o que **não** foi contado |
| Simplicidade | Troca revisar N cartões por revisar só as incertas (a medir: hoje não temos a taxa de linhas incertas por banco) |
| Viabilidade | Alta: reaproveita `import-draft`, `import-history`, `import-classify` |
| Prioridade | **P0 medir, P1 construir** |
| Métrica | toques e segundos por mês de extrato; % de linhas que chegam resolvidas sem edição, por banco |

### O2. Conta administrada para terceiros ("dinheiro que não é meu")
| Critério | Avaliação |
|---|---|
| Problema | Seu Itaú e o aluguel da sua mãe: o dinheiro passa pelas suas contas mas não é seu gasto nem sua receita. Hoje caberia como despesa/receita e distorce "Sobrou" |
| Evidência | **Só o seu caso**; nenhuma fonte de mercado lida (C: contas de familiares, Não foi possível determinar). Não é prova de necessidade geral |
| Solução | Uma conta ou um "bolso" marcado como "de terceiros": entradas e saídas dele **não contam** em receita/despesa/Sobrou; o patrimônio mostra "meu" separado de "administrado" (como já fizemos com reinvestimento: o registro existe, só não conta) |
| Diferencial | Possivelmente raro; **não confirmado** nos concorrentes |
| Simplicidade | Uma marcação por conta, sem categorias novas |
| Viabilidade | Média-alta: é um filtro nas mesmas somas (`isNewContribution` já mostrou o padrão). Cuidado com a transferência Santander → Itaú: precisa ser reconhecida como "para terceiros", não despesa |
| Prioridade | **P1** (valor alto para você; evidência de mercado nenhuma, então não generalizar) |
| Métrica | Sobrou e patrimônio batem com a sua conta manual; zero despesas de terceiros nos seus gastos |

### O3. Transferência próprias por par de movimentos, não só por nome
| Critério | Avaliação |
|---|---|
| Problema | Hoje o primeiro lado depende do nome impresso; outros apps tratam como ação manual (C). Resgate de CDB e Pix entre bancos têm o mesmo formato "dinheiro mudou de lugar" |
| Evidência | Dupla contagem em Goodbudget (relato isolado, D); Mobills e Controle Ágil: ação manual (C) |
| Solução | Quando um extrato é importado e já existe o par (mesmo valor, sentido oposto, poucos dias, contas suas), propor "é a mesma movimentação" e não contar nenhuma. Já existe para transferências declaradas; estender para resgate/aplicação e para o caso sem nome |
| Diferencial | Resolve na origem o que concorrentes deixam ao usuário (**nas fontes lidas**) |
| Simplicidade | Elimina conversões manuais |
| Viabilidade | Alta, com risco de falso positivo (dois pagamentos iguais no mesmo dia) |
| Prioridade | **P1** |
| Métrica | transferências reconhecidas sem edição / total; falsos positivos relatados (meta zero) |

### O4. Importação em lote e sem atrito
| Critério | Avaliação |
|---|---|
| Problema | 5 bancos = 5 importações |
| Evidência | Meu Dinheiro importa muitos formatos [OFICIAL]; Mobills limita OFX (6 meses, conta e cartão separados) [USUÁRIO/OFICIAL, C]; formatos de Inter, C6, Caixa **não confirmados** |
| Solução | Aceitar vários arquivos de uma vez, detectar banco e conta pelo conteúdo, perguntar só quando não souber; no Android, receber o arquivo pelo "Compartilhar" |
| Diferencial | Sem Open Finance, sem assinatura |
| Simplicidade | De N fluxos para 1 |
| Viabilidade | Média: detecção por banco exige amostras reais anonimizadas (P0) |
| Prioridade | P1 |
| Métrica | arquivos processados por sessão; % reconhecidos sem escolher conta |

### O5. Explicar e aprender: regras com confiança
| Critério | Avaliação |
|---|---|
| Problema | Categoria errada é queixa recorrente nos apps com classificação automática |
| Evidência | Copilot e Monarch mostram confiança e regras [OFICIAL]; categorização errada: alguns relatos (D) |
| Solução | Cada sugestão traz uma frase ("igual a 3 compras anteriores no mercado X"); corrigir uma vez cria regra visível e editável; sem confiança alta, pergunta |
| Diferencial | É esperado hoje, **não diferencial**; é condição para a O1 funcionar |
| Simplicidade | Elimina corrigir a mesma coisa todo mês |
| Viabilidade | Alta, regra simples antes de qualquer IA |
| Prioridade | P1 |
| Métrica | % de sugestões aceitas; correções repetidas (meta: nenhuma repetida) |

### O6. Tela inicial por decisão: "o que tenho, devo, comprometi, entrou e saiu, precisa de mim, o app resolveu"
| Critério | Avaliação |
|---|---|
| Problema | Navegar por dezenas de telas |
| Evidência | **Apenas a sua diretriz**, nenhuma fonte de mercado lida mede isso: [HIPÓTESE] |
| Solução | Uma tela com 6 números e 1 lista; já existem as peças (`summary-hero`, `todo-list`, orçamentos, faturas, patrimônio) |
| Diferencial | Possível, a validar com 2 ou 3 pessoas |
| Simplicidade | Menos navegação; **só vale se as outras telas ficarem em segundo plano** |
| Viabilidade | Alta, é reorganização |
| Prioridade | P1/P2 |
| Métrica | tempo até responder "quanto posso gastar este mês" (cronometrar antes e depois) |

### O7 (a evitar por ora). Linguagem natural, QR de nota fiscal, captura de Pix
Open Finance: **decisão do proprietário, fora do produto.** O app depende só de arquivos importados.
Evidência de que resolvem problema importante: **nenhuma** nas fontes lidas (D); Open Finance é a maior fonte de queixa dos concorrentes (A, D) e o custo para um app pequeno é Não foi possível determinar (C). Recomendação: não construir agora. A frase em português que já temos fica como está.

## 4. Experiência ideal para quem nunca usou um app financeiro

1. **Primeira abertura (menos de 1 minuto):** "Seu nome como o banco escreve" (uma pergunta) e "Arraste os extratos que você tem". Nada de cadastrar contas em formulário: o app cria a conta ao reconhecer o arquivo.
2. **Resultado imediato:** os seus 6 números (tenho, devo, comprometido, entrou e saiu, precisa de você, o app resolveu) já preenchidos com os últimos meses importados.
3. **"Precisa de você" com poucas perguntas**, cada uma em linguagem simples, com o motivo ("parece uma parcela, mas o texto não diz parcela").
4. **Todo mês:** um aviso e o mesmo gesto: arrastar os extratos novos, confirmar, pronto.
Não é possível prometer "automático" sem conexão bancária: o app fica pronto assim que o arquivo entra. Declaro isso como a principal troca de honestidade da proposta.

## 5. O que manter, simplificar, reformular, remover

Esta classificação é **[HIPÓTESE]**: baseada nos módulos e nas telas, sem sessão de uso real.

| Ação | Itens | Motivo |
|---|---|---|
| Manter | Importação, transferências próprias, faturas e parcelas, reinvestimento, patrimônio, meta e projeção, backup, bloqueio do app | É o núcleo do seu cenário e já tem testes |
| Reformular | Revisão da importação: de passo escondido para a tela principal (O1); lista "o que fazer agora" para a fila única | A inteligência já existe; a posição na navegação não ajuda |
| Simplificar | Telas de relatórios e detalhes por categoria, orçamentos, contas do mês, insights: esconder atrás de "Ver mais" e medir se alguém abre | 58 módulos de domínio e dezenas de telas; critério da diretriz é eliminar etapas |
| Remover (avaliar, não decidir) | Qualquer tela sem uso medido | Hoje **não há medição de uso**; sem dados não removo nada. Primeiro instrumentar localmente, sem enviar dados |

## 6. Riscos

- **Dinheiro:** automação nunca grava sem confirmação do que tem baixa certeza; o resolvido pelo app precisa ser **auditável e reversível** (mostrar o que foi feito e desfazer).
- **Falso positivo de transferência:** dois gastos iguais no mesmo dia podem ser fundidos por engano. Regra: só propor, nunca fundir sozinho quando houver mais de um candidato.
- **Terceiros:** não generalizar do seu caso sem ouvir mais pessoas.
- **Técnicos:** PDF de banco muda de layout; formatos de Inter, C6 e Caixa não confirmados; captura por notificação depende do Android.
- **Pesquisa:** Reddit e Google Play não foram lidos; a recomendação deve ser revista com esses dados.

## 7. Visão de curto, médio e longo prazo

**Curto (menor conjunto de mudanças):**
1. P0: medir. Importar 1 mês de cada um dos seus 5 bancos (arquivos reais, você mesmo, anonimizando o que for enviado a terceiros) e registrar quantas linhas chegam resolvidas, incertas e erradas, e o tempo/toques.
2. P1: fila única "Precisa de você" com bloco "Resolvido pelo app" e "Não contei" (O1).
3. P1: marcar conta como "de terceiros" (O2).
4. P1: explicar cada sugestão em uma frase e guardar a correção como regra visível (O5).

**Médio:** importação em lote com detecção de banco e conta (O4); pares de movimentação sem nome para transferências e resgates (O3); tela inicial por decisão (O6) depois de testar com 2 ou 3 pessoas.

**Longo:** captura por notificação no Android; conta compartilhada/família se a necessidade for confirmada fora do seu caso. Open Finance está fora do produto por decisão do proprietário (2026-11-27).

## 8. Decisões que preciso de você

1. O foco curto prazo (O1 + O2 + O5) está certo para você, ou o seu maior incômodo é outro?
2. Autoriza o teste P0 com seus extratos? Prefiro que você rode e me passe só o resultado, sem enviar os arquivos para fora da máquina.
3. A conta da sua mãe: o quanto você quer separar? (a) só não contar nos gastos; (b) também ver "administrado" à parte no patrimônio.
4. Quer uma segunda rodada de pesquisa (Reddit, Google Play, instalar concorrentes) antes de construir?

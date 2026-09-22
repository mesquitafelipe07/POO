import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

// interfaces
interface AtualizavelPorTurno {
  novoTurno(): void
}

interface Arma {
  readonly nome: string
  atacar(): number
  atualizarTurno(): void
}

interface Efeito extends AtualizavelPorTurno {
  estaAtivo(): boolean
  nome(): string
}

interface ItemBase {
  nome: string
  valor: number
}

interface ItemConsumivel extends ItemBase {
  usar(dono: Personagem, oponente: Personagem): void
  atualizarTurno(): void
}

interface HabilidadeEspecial extends AtualizavelPorTurno {
  readonly nome: string
  disponivel(usuario: Personagem): boolean
  usar(usuario: Personagem, participantes: Personagem[]): void
}

// cooldown
class Cooldown {
  private turnosRestantes: number = 0

  constructor(private readonly duracaoEmTurnos: number) {}

  disponivel(): boolean {
    return this.turnosRestantes <= 0
  }

  iniciar(): void {
    this.turnosRestantes = this.duracaoEmTurnos
  }

  diminuir(): void {
    if (this.turnosRestantes > 0) this.turnosRestantes--
  }

  get restante(): number {
    return this.turnosRestantes
  }
}

// armas
class Espada implements Arma {
  readonly nome = 'Espada'
  private readonly cooldown: Cooldown

  constructor(
    private readonly dano: number = 10, duracaoCooldown: number = 3
  ) {
    this.cooldown = new Cooldown(duracaoCooldown)
  }

  atacar(): number {
    if (!this.cooldown.disponivel()) {
      console.log(`${this.nome} em cooldown (${this.cooldown.restante} turno(s) restante(s)).`)
      return 0
    }
    this.cooldown.iniciar()
    return this.dano
  }

  atualizarTurno(): void {
    this.cooldown.diminuir()
  }
}

class Arco implements Arma {
  readonly nome = 'Arco'
  private readonly cooldown: Cooldown
  private flechas: number
  private flechasGastas: number = 0

  constructor(
    private readonly dano: number = 15,
    duracaoCooldown: number = 3,
    flechasIniciais: number = 5
  ) {
    this.flechas = flechasIniciais
    this.cooldown = new Cooldown(duracaoCooldown)
  }

  atacar(): number {
    if (!this.cooldown.disponivel()) {
      console.log(`${this.nome} em cooldown (${this.cooldown.restante} turno(s) restante(s)).`)
      return 0
    }
    if (this.flechas <= 0) {
      console.log(`${this.nome} sem flechas!`)
      return 0
    }
    this.flechas--
    this.flechasGastas++
    if (this.flechasGastas % 2 === 0) {
      this.flechas++
      console.log(`${this.nome} recarregou automaticamente (flechas: ${this.flechas}).`)
    }
    this.cooldown.iniciar()
    return this.dano
  }

  recarregar(quantidade: number): void {
    this.flechas += quantidade
    console.log(`${this.nome} recarregado manualmente. Flechas: ${this.flechas}`)
  }

  atualizarTurno(): void {
    this.cooldown.diminuir()
  }

  get flechasRestantes(): number {
    return this.flechas
  }
}

class VarinhaMagica implements Arma {
  readonly nome = 'Varinha Mágica'
  private readonly cooldown: Cooldown
  private mana: number

  constructor(
    private readonly dano: number = 20,
    duracaoCooldown: number = 5,
    manaInicial: number = 120,
    private readonly custoMana: number = 15
  ) {
    this.mana = manaInicial
    this.cooldown = new Cooldown(duracaoCooldown)
  }

  atacar(): number {
    if (!this.cooldown.disponivel()) {
      console.log(`${this.nome} em cooldown (${this.cooldown.restante} turno(s) restante(s)).`)
      return 0
    }
    if (this.mana < this.custoMana) {
      console.log(`${this.nome} sem mana suficiente!`)
      return 0
    }
    this.mana -= this.custoMana
    this.cooldown.iniciar()
    return this.dano
  }

  recuperarMana(quantidade: number): void {
    this.mana += quantidade
    console.log(`${this.nome} recuperou mana. Mana: ${this.mana}`)
  }

  atualizarTurno(): void {
    this.cooldown.diminuir()
  }

  get manaAtual(): number {
    return this.mana
  }
}

// itens
class Item implements ItemBase {
  constructor(public readonly nome: string, public readonly valor: number) {}
}

class PocaoDeRegeneracao implements ItemConsumivel {
  readonly nome = 'Poção de Regeneração'
  readonly valor = 30
  // 3 turnos ativos + 2 turnos de espera = 5 turnos próprios até reutilizar
  private readonly cooldown = new Cooldown(11)

  usar(dono: Personagem, _oponente: Personagem): void {
    if (!this.cooldown.disponivel()) return
    this.cooldown.iniciar()
    console.log(`${dono.nome} bebe ${this.nome}.`)
    dono.aplicarEfeito(new Regeneracao(dono, 20, 3))
  }

  atualizarTurno(): void {
    this.cooldown.diminuir()
  }
}

class PocaoDeVeneno implements ItemConsumivel {
  readonly nome = 'Poção de Veneno'
  readonly valor = 30
  private readonly cooldown = new Cooldown(11)

  usar(dono: Personagem, oponente: Personagem): void {
    if (!this.cooldown.disponivel()) return
    this.cooldown.iniciar()
    console.log(`${dono.nome} lança ${this.nome} em ${oponente.nome}.`)
    oponente.aplicarEfeito(new Veneno(oponente, 10, 3))
  }

  atualizarTurno(): void {
    this.cooldown.diminuir()
  }
}

class ItemNenhum implements ItemConsumivel {
  readonly nome = 'Nenhum'
  readonly valor = 0
  usar(): void {}
  atualizarTurno(): void {}
}

class Inventario {
  private itens: ItemBase[] = []

  adicionar(item: ItemBase): void {
    this.itens.push(item)
  }

  remover(item: ItemBase): void {
    this.itens = this.itens.filter(i => i !== item)
  }

  listar(): void {
    console.log('Inventário:')
    if (this.itens.length === 0) {
      console.log('  (vazio)')
      return
    }
    for (const item of this.itens) {
      console.log(`  - ${item.nome} (valor: ${item.valor})`)
    }
  }
}

// habilidades especiais
class BolaDeFogo implements HabilidadeEspecial {
  readonly nome = 'Bola de Fogo'
  private readonly cooldown = new Cooldown(2)
  private readonly custoMana = 20
  private readonly dano = 40

  disponivel(usuario: Personagem): boolean {
    return this.cooldown.disponivel() && usuario.manaSuficiente(this.custoMana)
  }

  usar(usuario: Personagem, participantes: Personagem[]): void {
    if (!this.disponivel(usuario)) return
    const alvo = participantes.find(p => p !== usuario && p.estaVivo())
    if (!alvo) return
    this.cooldown.iniciar()
    usuario.gastarMana(this.custoMana)
    console.log(`${usuario.nome} lança ${this.nome} em ${alvo.nome}!`)
    alvo.receberDano(this.dano)
  }

  novoTurno(): void {
    this.cooldown.diminuir()
  }
}

class Cura implements HabilidadeEspecial {
  readonly nome = 'Cura'
  private readonly cooldown = new Cooldown(1)
  private readonly custoMana = 15
  private readonly valor = 30

  disponivel(usuario: Personagem): boolean {
    return this.cooldown.disponivel() && usuario.manaSuficiente(this.custoMana)
  }

  usar(usuario: Personagem, _participantes: Personagem[]): void {
    if (!this.disponivel(usuario)) return
    this.cooldown.iniciar()
    usuario.gastarMana(this.custoMana)
    console.log(`${usuario.nome} usa ${this.nome} em si mesmo!`)
    usuario.curar(this.valor)
  }

  novoTurno(): void {
    this.cooldown.diminuir()
  }
}

class GolpePoderoso implements HabilidadeEspecial {
  readonly nome = 'Golpe Poderoso'
  private readonly cooldown = new Cooldown(3)
  private readonly custoMana = 0 // não consome mana
  private readonly dano = 60

  disponivel(usuario: Personagem): boolean {
    return this.cooldown.disponivel() && usuario.manaSuficiente(this.custoMana)
  }

  usar(usuario: Personagem, participantes: Personagem[]): void {
    if (!this.disponivel(usuario)) return
    const alvo = participantes.find(p => p !== usuario && p.estaVivo())
    if (!alvo) return
    this.cooldown.iniciar()
    usuario.gastarMana(this.custoMana)
    console.log(`${usuario.nome} desfere ${this.nome} em ${alvo.nome}!`)
    alvo.receberDano(this.dano)
  }

  novoTurno(): void {
    this.cooldown.diminuir()
  }
}

class Explosao implements HabilidadeEspecial {
  readonly nome = 'Explosão'
  private readonly cooldown = new Cooldown(3)
  private readonly custoMana = 25
  private readonly dano = 20

  disponivel(usuario: Personagem): boolean {
    return this.cooldown.disponivel() && usuario.manaSuficiente(this.custoMana)
  }

  usar(usuario: Personagem, participantes: Personagem[]): void {
    if (!this.disponivel(usuario)) return
    const alvos = participantes.filter(p => p !== usuario && p.estaVivo())
    if (alvos.length === 0) return
    this.cooldown.iniciar()
    usuario.gastarMana(this.custoMana)
    console.log(`${usuario.nome} conjura ${this.nome}, atingindo ${alvos.length} inimigo(s)!`)
    for (const alvo of alvos) {
      alvo.receberDano(this.dano)
    }
  }

  novoTurno(): void {
    this.cooldown.diminuir()
  }
}

class Congelar implements HabilidadeEspecial {
  readonly nome = 'Congelar'
  private readonly cooldown = new Cooldown(4)
  private readonly custoMana = 20
  private readonly turnosDeCongelamento = 1

  disponivel(usuario: Personagem): boolean {
    return this.cooldown.disponivel() && usuario.manaSuficiente(this.custoMana)
  }

  usar(usuario: Personagem, participantes: Personagem[]): void {
    if (!this.disponivel(usuario)) return
    const alvo = participantes.find(p => p !== usuario && p.estaVivo())
    if (!alvo) return
    this.cooldown.iniciar()
    usuario.gastarMana(this.custoMana)
    console.log(`${usuario.nome} usa ${this.nome} em ${alvo.nome}!`)
    alvo.congelar(this.turnosDeCongelamento)
  }

  novoTurno(): void {
    this.cooldown.diminuir()
  }
}

// personagem
class Personagem implements AtualizavelPorTurno {
  private vida: number
  private mana: number
  private nivel: number = 1
  private experiencia: number = 0
  private readonly inventario: Inventario
  private itemEquipado: ItemConsumivel = new ItemNenhum()
  private efeitosAtivos: Efeito[] = []
  private habilidades: HabilidadeEspecial[] = []
  private turnosCongelado: number = 0

  constructor(
    public readonly nome: string,
    private readonly arma: Arma,
    private vidaMaxima: number = 200,
    private manaMaxima: number = 150
  ) {
    this.vida = vidaMaxima
    this.mana = manaMaxima
    this.inventario = new Inventario()
  }

  private processarEfeitos(): void {
    for (const efeito of this.efeitosAtivos) {
      efeito.novoTurno()
    }
    this.efeitosAtivos = this.efeitosAtivos.filter(e => e.estaAtivo())
  }

  aplicarEfeito(efeito: Efeito): void {
    this.efeitosAtivos.push(efeito)
  }

  aprenderHabilidade(habilidade: HabilidadeEspecial): void {
    this.habilidades.push(habilidade)
  }

  private tentarUsarHabilidade(participantes: Personagem[]): boolean {
    for (const habilidade of this.habilidades) {
      if (habilidade.disponivel(this)) {
        habilidade.usar(this, participantes)
        return true
      }
    }
    return false
  }

  atacar(inimigo: Personagem): void {
    const dano = this.arma.atacar()
    if (dano <= 0) return
    console.log(`${this.nome} ataca ${inimigo.nome} com ${this.arma.nome} (${dano} de dano)`)
    inimigo.receberDano(dano)
    this.ganharExperiencia(10)
  }

  executarTurno(participantes: Personagem[]): void {
    this.processarEfeitos()

    if (this.estaCongelado) {
      console.log(`${this.nome} está congelado e perde a vez!`)
      this.turnosCongelado--
      return
    }

    const oponente = participantes.find(p => p !== this) ?? this
    this.itemEquipado.usar(this, oponente)

    const usouHabilidade = this.tentarUsarHabilidade(participantes)
    if (!usouHabilidade) {
      const alvo = participantes.find(p => p !== this && p.estaVivo())
      if (alvo) this.atacar(alvo)
    }
  }

  receberDano(dano: number): void {
    const vidaAntes = this.vida
    this.vida = Math.max(0, this.vida - dano)
    console.log(`${this.nome} sofre ${vidaAntes - this.vida} de dano. Vida: ${this.vida}/${this.vidaMaxima}`)
    if (!this.estaVivo()) console.log(`${this.nome} foi derrotado!`)
  }

  curar(quantidade: number): void {
    this.vida = Math.min(this.vidaMaxima, this.vida + quantidade)
    console.log(`${this.nome} recupera vida. Vida: ${this.vida}/${this.vidaMaxima}`)
  }

  estaVivo(): boolean {
    return this.vida > 0
  }

  ganharExperiencia(quantidade: number): void {
    this.experiencia += quantidade
    if (this.experiencia >= 100) this.subirDeNivel()
  }

  private subirDeNivel(): void {
    this.nivel++
    this.experiencia = 0
    this.vidaMaxima += 20
    this.vida = this.vidaMaxima
    console.log(`${this.nome} subiu para o nível ${this.nivel}!`)
  }

  // ---- mana encapsulada, igual vida e experiência ----
  manaSuficiente(quantidade: number): boolean {
    return this.mana >= quantidade
  }

  gastarMana(quantidade: number): void {
    this.mana = Math.max(0, this.mana - quantidade)
  }

  recuperarMana(quantidade: number): void {
    this.mana = Math.min(this.manaMaxima, this.mana + quantidade)
    console.log(`${this.nome} recupera mana. Mana: ${this.mana}/${this.manaMaxima}`)
  }

  get manaAtual(): number {
    return this.mana
  }

  congelar(turnos: number): void {
    this.turnosCongelado += turnos
    console.log(`${this.nome} foi congelado por ${turnos} turno(s)!`)
  }

  get estaCongelado(): boolean {
    return this.turnosCongelado > 0
  }

  adicionarItem(item: ItemBase): void {
    this.inventario.adicionar(item)
  }

  equiparItem(item: ItemConsumivel): void {
    this.itemEquipado = item
    this.adicionarItem(item)
  }

  mostrarInventario(): void {
    this.inventario.listar()
  }

  get vidaAtual(): number {
    return this.vida
  }

  get nomeDaArma(): string {
    return this.arma.nome
  }

  novoTurno(): void {
    if (!this.estaCongelado) {
      this.arma.atualizarTurno()
      this.itemEquipado.atualizarTurno()
    } else {
      console.log(`${this.nome} está congelado: cooldown de arma e item não avançam.`)
    }
    for (const habilidade of this.habilidades) {
      habilidade.novoTurno()
    }
  }
}

// efeitos
class Veneno implements Efeito {
  private turnosRestantes: number

  constructor(private readonly alvo: Personagem, private readonly danoPorTurno: number, duracao: number) {
    this.turnosRestantes = duracao
  }

  novoTurno(): void {
    if (!this.estaAtivo()) return
    this.alvo.receberDano(this.danoPorTurno)
    console.log(`[Veneno] ${this.alvo.nome} sofre ${this.danoPorTurno} de dano contínuo.`)
    this.turnosRestantes--
  }

  estaAtivo(): boolean {
    return this.turnosRestantes > 0 && this.alvo.estaVivo()
  }

  nome(): string {
    return 'Veneno'
  }
}

class Regeneracao implements Efeito {
  private turnosRestantes: number

  constructor(private readonly alvo: Personagem, private readonly curaPorTurno: number, duracao: number) {
    this.turnosRestantes = duracao
  }

  novoTurno(): void {
    if (!this.estaAtivo()) return
    this.alvo.curar(this.curaPorTurno)
    console.log(`[Regeneração] ${this.alvo.nome} recupera ${this.curaPorTurno} de vida.`)
    this.turnosRestantes--
  }

  estaAtivo(): boolean {
    return this.turnosRestantes > 0 && this.alvo.estaVivo()
  }

  nome(): string {
    return 'Regeneração'
  }
}

// jogo
class Jogo {
  private personagens: Personagem[] = []
  private observadores: AtualizavelPorTurno[] = []
  private turnoAtual: number = 0

  adicionarPersonagem(personagem: Personagem): void {
    this.personagens.push(personagem)
    this.registrar(personagem)
  }

  registrar(objeto: AtualizavelPorTurno): void {
    this.observadores.push(objeto)
  }

  passarTurno(): void {
    this.turnoAtual++
    for (const observador of this.observadores) observador.novoTurno()
  }

  get participantes(): ReadonlyArray<Personagem> {
    return this.personagens
  }

  get numeroDoTurno(): number {
    return this.turnoAtual
  }
}

// fábricas
type ClasseEscolhida = 'barbaro' | 'arqueiro' | 'mago'
type ItemEscolhido = 'regeneracao' | 'veneno' | 'nenhum'

function criarArma(classe: ClasseEscolhida): Arma {
  const fabricas: Record<ClasseEscolhida, () => Arma> = {
    barbaro: () => new Espada(),
    arqueiro: () => new Arco(),
    mago: () => new VarinhaMagica(),
  }
  return fabricas[classe]()
}

function criarItem(tipo: ItemEscolhido): ItemConsumivel {
  const fabricas: Record<ItemEscolhido, () => ItemConsumivel> = {
    regeneracao: () => new PocaoDeRegeneracao(),
    veneno: () => new PocaoDeVeneno(),
    nenhum: () => new ItemNenhum(),
  }
  return fabricas[tipo]()
}

function criarHabilidadesPadrao(): HabilidadeEspecial[] {
  return [new GolpePoderoso(), new BolaDeFogo(), new Explosao(), new Congelar(), new Cura()]
}

// demonstração dos requisitos básicos
function demonstrarRequisitosBasicos(): void {
  console.log('DEMONSTRAÇÃO DOS REQUISITOS BÁSICOS:')

  console.log('\nCriação das 3 armas diferentes:')
  const espada = new Espada()
  const arco = new Arco()
  const varinha = new VarinhaMagica()
  console.log(`Armas criadas: ${espada.nome}, ${arco.nome}, ${varinha.nome}`)

  console.log('\nCooldown bloqueando um ataque de fato:')
  console.log(`1º ataque: ${espada.atacar()} de dano`)
  console.log(`2º ataque imediato (sem passar turno): ${espada.atacar()} de dano (deve ser 0, cooldown ativo)`)

  console.log('\nConsumo e recarga manual de flechas:')
  arco.atacar()
  arco.atacar()
  arco.atacar()
  console.log(`Flechas restantes: ${arco.flechasRestantes}`)
  arco.recarregar(3)

  console.log('\nConsumo e recuperação manual de mana da Varinha:')
  varinha.atacar()
  console.log(`Mana restante: ${varinha.manaAtual}`)
  varinha.recuperarMana(20)

  console.log('\nInventário sendo usado:')
  const exemplo = new Personagem('Exemplo', new Espada())
  exemplo.adicionarItem(new Item('Poção de Vida', 20))
  exemplo.adicionarItem(new Item('Amuleto Antigo', 100))
  exemplo.mostrarInventario()

  console.log('\nFIM DA DEMONSTRAÇÃO\n')
}

// demonstração das habilidades especiais
function demonstrarHabilidadesEspeciais(): void {
  console.log('DEMONSTRAÇÃO DAS HABILIDADES ESPECIAIS:')

  const mago = new Personagem('Mago de Teste', new VarinhaMagica())
  const alvo = new Personagem('Alvo de Teste', new Espada())
  const participantes = [mago, alvo]

  console.log('\n-- Bola de Fogo (dano + mana + cooldown) --')
  const bolaDeFogo = new BolaDeFogo()
  console.log(`Mana do mago antes: ${mago.manaAtual}`)
  bolaDeFogo.usar(mago, participantes)
  console.log(`Mana do mago depois: ${mago.manaAtual} | Vida do alvo: ${alvo.vidaAtual}`)
  bolaDeFogo.usar(mago, participantes) // deve falhar: cooldown ainda ativo
  console.log(`Vida do alvo (2ª tentativa, não deve mudar): ${alvo.vidaAtual}`)

  console.log('\n-- Cura --')
  const cura = new Cura()
  alvo.receberDano(50)
  console.log(`Vida do alvo antes de curar: ${alvo.vidaAtual}`)
  cura.usar(alvo, participantes)
  console.log(`Vida do alvo depois de curar: ${alvo.vidaAtual}`)

  console.log('\n-- Golpe Poderoso (sem custo de mana) --')
  const golpePoderoso = new GolpePoderoso()
  console.log(`Mana do mago antes: ${mago.manaAtual}`)
  golpePoderoso.usar(mago, participantes)
  console.log(`Mana do mago depois (não deve mudar): ${mago.manaAtual} | Vida do alvo: ${alvo.vidaAtual}`)

  console.log('\n-- Explosão (atinge todos os inimigos, sem condição especial) --')
  const explosao = new Explosao()
  const alvo2 = new Personagem('Segundo Alvo', new Arco())
  const participantesComDois = [mago, alvo, alvo2]
  explosao.usar(mago, participantesComDois)
  console.log(`Vida de ${alvo.nome}: ${alvo.vidaAtual} | Vida de ${alvo2.nome}: ${alvo2.vidaAtual}`)

  console.log('\n-- Congelar --')
  const congelar = new Congelar()
  congelar.usar(mago, participantes)
  console.log(`${alvo.nome} tenta agir estando congelado (não deve atacar):`)
  alvo.executarTurno(participantes)
  console.log(`${alvo.nome} tenta avançar cooldown de arma/item (não deve mudar):`)
  alvo.novoTurno()
  console.log(`${alvo.nome} age de novo, já descongelado:`)
  alvo.executarTurno(participantes)

  console.log('\nFIM DA DEMONSTRAÇÃO DE HABILIDADES\n')
}

// interação com o usuário
async function perguntarClasse(rl: readline.Interface, jogador: string): Promise<ClasseEscolhida> {
  const opcoes: ClasseEscolhida[] = ['barbaro', 'arqueiro', 'mago']
  console.log(`\n${jogador}, escolha seu personagem:`)
  opcoes.forEach((classe, i) => {
    const armaDeTeste = criarArma(classe)
    console.log(`  ${i + 1} - ${classe} (arma: ${armaDeTeste.nome})`)
  })

  while (true) {
    const resposta = await rl.question('Digite o número: ')
    const indice = Number(resposta.trim()) - 1
    if (indice >= 0 && indice < opcoes.length) return opcoes[indice]
    console.log('Opção inválida, tente novamente.')
  }
}

async function perguntarItem(rl: readline.Interface, jogador: string): Promise<ItemEscolhido> {
  const opcoes: ItemEscolhido[] = ['regeneracao', 'veneno', 'nenhum']
  console.log(`\n${jogador}, escolha seu item (reutilizável a cada 5 turnos próprios):`)
  console.log('  1 - Poção de Regeneração')
  console.log('  2 - Poção de Veneno')
  console.log('  3 - Nenhum')

  while (true) {
    const resposta = await rl.question('Digite o número: ')
    const indice = Number(resposta.trim()) - 1
    if (indice >= 0 && indice < opcoes.length) return opcoes[indice]
    console.log('Opção inválida, tente novamente.')
  }
}

// motor de duelo
const LIMITE_DE_TURNOS = 100

function jogarDuelo(
  nome1: string, classe1: ClasseEscolhida, item1: ItemEscolhido,
  nome2: string, classe2: ClasseEscolhida, item2: ItemEscolhido
): void {
  const jogo = new Jogo()
  const p1 = new Personagem(nome1, criarArma(classe1))
  const p2 = new Personagem(nome2, criarArma(classe2))

  jogo.adicionarPersonagem(p1)
  jogo.adicionarPersonagem(p2)
  p1.equiparItem(criarItem(item1))
  p2.equiparItem(criarItem(item2))

  criarHabilidadesPadrao().forEach(h => p1.aprenderHabilidade(h))
  criarHabilidadesPadrao().forEach(h => p2.aprenderHabilidade(h))

  console.log(`\nParticipantes no Jogo: ${jogo.participantes.map(p => p.nome).join(', ')}`)
  console.log(`\n${nome1} (${classe1}) VS ${nome2} (${classe2})`)

  let turno = 0
  while (turno < LIMITE_DE_TURNOS) {
    turno++
    const atacante = (turno % 2 === 1) ? p1 : p2
    const defensor = (turno % 2 === 1) ? p2 : p1

    console.log(`\nTurno ${turno}: vez de ${atacante.nome}!`)
    atacante.executarTurno([...jogo.participantes])

    if (!defensor.estaVivo()) {
      console.log(`\nFIM DE JOGO: ${atacante.nome} venceu em ${turno} turnos!`)
      return
    }

    jogo.passarTurno()

    if (!p1.estaVivo() || !p2.estaVivo()) {
      const vencedor = p1.estaVivo() ? p1.nome : p2.nome
      console.log(`\nFIM DE JOGO: ${vencedor} venceu em ${turno} turnos!`)
      return
    }
  }

  console.log(`\nEMPATE: limite de ${LIMITE_DE_TURNOS} turnos atingido`)
}

// menu principal
async function menuPrincipal(rl: readline.Interface): Promise<void> {
  while (true) {
    console.log('\nMENU:')
    console.log('1 - Montar minha própria partida')
    console.log('0 - Sair')

    const opcao = (await rl.question('Digite sua opção: ')).trim()

    if (opcao === '0') {
      console.log('Saindo do jogo. Até a próxima!')
      return
    }

    if (opcao === '1') {
      const classe1 = await perguntarClasse(rl, 'Jogador 1')
      const item1 = await perguntarItem(rl, 'Jogador 1')
      const classe2 = await perguntarClasse(rl, 'Jogador 2')
      const item2 = await perguntarItem(rl, 'Jogador 2')

      jogarDuelo('Jogador 1', classe1, item1, 'Jogador 2', classe2, item2)
      continue
    }

    console.log('Opção inválida, tente novamente.')
  }
}

// main
async function main(): Promise<void> {
  demonstrarRequisitosBasicos()
  demonstrarHabilidadesEspeciais()

  console.log('\nPARTIDA AUTOMÁTICA DE DEMONSTRAÇÃO')
  jogarDuelo('Bárbaro Exemplo', 'barbaro', 'veneno', 'Mago Exemplo', 'mago', 'regeneracao')

  const rl = readline.createInterface({ input, output })
  await menuPrincipal(rl)
  rl.close()
}

main()
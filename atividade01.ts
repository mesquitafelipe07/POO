interface Personagem {
    nome: string;
    pontos_vida: number;
}

function ataque(alvo: Personagem, dano: number): void {
    alvo.pontos_vida -= dano;
    if (alvo.pontos_vida < 0) {
        alvo.pontos_vida = 0;
    }
    console.log(`${alvo.nome} recebeu ${dano} de dano! PV restante: ${alvo.pontos_vida}`);
}

function main(): void {
    const heroi: Personagem = {
        nome: "Aragorn",
        pontos_vida: 100
    };
    console.log(`Personagem criado: ${heroi.nome} com ${heroi.pontos_vida} PV.\n`);
    ataque(heroi, 30);
    ataque(heroi, 80);
}

main();
// Crée ou met à jour l'unique compte administrateur à partir des variables
// d'environnement. Il n'existe pas d'inscription publique (voir CLAUDE.md §7) :
// c'est la seule façon de provisionner/changer les identifiants admin.
//
// Usage : ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run seed:admin
import { hash } from 'bcryptjs';
import { db } from './db.js';

const SALT_ROUNDS = 12;

async function main() {
  const username = process.env['ADMIN_USERNAME'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME et ADMIN_PASSWORD doivent être définis (dans .env ou en ligne de commande).');
  }

  const hashedPassword = await hash(password, SALT_ROUNDS);

  await db.orm.users.where({ username }).upsert({
    create: { username, password: hashedPassword },
    update: { password: hashedPassword },
  });

  console.log(`Compte administrateur "${username}" prêt.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });

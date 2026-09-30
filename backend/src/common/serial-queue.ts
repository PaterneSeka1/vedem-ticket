/**
 * File d'exécution séquentielle, en mémoire : les tâches passées à la
 * fonction retournée s'exécutent une par une, dans l'ordre d'arrivée, même si
 * elles sont lancées en parallèle (double-clic, deux onglets du dashboard…).
 * Une tâche en échec n'empêche pas les suivantes de s'exécuter.
 *
 * Comme `RateLimit`, suffisant pour un déploiement mono-instance (PM2
 * `instances: 1`) ; ne sérialise rien entre plusieurs instances.
 *
 * Non réentrante : une tâche ne doit pas attendre une autre tâche de la même
 * file (elle attendrait sa propre fin).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

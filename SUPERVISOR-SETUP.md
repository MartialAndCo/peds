# 🚀 Setup Supervisor AI - Sans risque pour la base

## ⚠️ Important
Le Supervisor AI est déjà codé. Il ne manque que la création de la table `supervisor_alerts` dans ta base.

---

## Option 1 : Méthode Prisma db push (RECOMMANDÉE - La plus sûre)

Cette commande compare ton schema.prisma avec la base actuelle et ajoute UNIQUEMENT ce qui manque.

```bash
# Dans ton terminal (dossier peds)
npx prisma db push
```

**Pourquoi c'est sûr :**
- ✅ N'efface PAS les tables existantes
- ✅ Ajoute UNIQUEMENT la nouvelle table `supervisor_alerts`
- ✅ Aucune donnée perdue
- ⚠️ Si Prisma demande confirmation, dis "Yes"

---

## Option 2 : Script SQL manuel (Contrôle total)

Exécute le fichier SQL que je t'ai créé dans ton outil de base de données :

**Fichier** : `prisma/add_supervisor_table.sql`

### Avec un outil comme pgAdmin / DBeaver / TablePlus :
1. Ouvre ton outil de gestion PostgreSQL
2. Connecte-toi à ta base
3. Exécute le script : `prisma/add_supervisor_table.sql`

### Avec la ligne de commande (psql) :
```bash
# Remplace DATABASE_URL par ta vraie URL de connexion
psql "DATABASE_URL" -f prisma/add_supervisor_table.sql
```

---

## Option 3 : Via l'interface Supabase / Railway

Si ta base est sur Supabase ou Railway :
1. Va dans l'interface SQL Editor
2. Copie-colle le contenu de `prisma/add_supervisor_table.sql`
3. Exécute

---

## Après création de la table

Quelle que soit la méthode choisie, fais ensuite :

```bash
# Met à jour le client Prisma
npx prisma generate

# Redémarre ton serveur
npm run dev
```

---

## ✅ Vérification

Pour vérifier que tout fonctionne :

```bash
# Ouvre Prisma Studio
npx prisma studio
```

Tu devrais voir la nouvelle table `supervisor_alerts` dans la liste.

---

## 🎯 Tu es prêt !

Une fois la table créée :
1. Le Supervisor surveillera automatiquement tes IA
2. Les alertes apparaîtront dans `/admin/supervisor`
3. Les notifications CRITICAL arriveront sur ton PWA

Si tu veux tester immédiatement : envoie un message à un agent et regarde la console - tu verras le Supervisor s'activer !

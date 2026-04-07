# 🚀 Guide de Connexion SSH et Gestion du Serveur (Control Tower V1)

Ce guide explique comment se connecter au serveur distant et où trouver les différents dossiers du projet `control-tower-v1`.

## 1. 🌐 Se connecter en SSH

Ouvre un terminal (PowerShell, Command Prompt, ou terminal VS Code) et execute la commande suivante :

```bash
ssh -i C:\Users\marti\.ssh\id_ed25519 root@100.83.190.29
```

*Note: Le paramètre `-i` spécifie la clé privée à utiliser pour s'authentifier.*

---

## 2. 📂 Les dossiers du projet sur le serveur

Une fois connecté, tu as deux dossiers principaux à connaître :

### A. Le Workspace (Dossier de travail / Code Source)
C'est ici que se trouve le code source brut du projet. Si tu utilises des outils ou des agents pour modifier le code sur le serveur, c'est généralement dans ce dossier que les modifications sont apportées.

**Chemin :**
```bash
/root/.openclaw/workspace/control-tower-v1/
```

**Pour y aller :**
```bash
cd /root/.openclaw/workspace/control-tower-v1/
```

### B. Le dossier de Production (Le site en ligne)
C'est depuis ce dossier que tourne réellement l'application en ligne (gérée par PM2).

**Chemin :**
```bash
/opt/control-tower-v1/current/
```

**Pour y aller :**
```bash
cd /opt/control-tower-v1/current/
```

---

## 3. 🔄 Comment déployer une modification ?

Si tu as fait des modifications dans le workspace (`/root/...`), elles ne seront pas visibles immédiatement en ligne. L'application tourne depuis `/opt/...` et a besoin d'être reconstruite.

Pour synchroniser tes modifications et mettre à jour le site :

1. Aller dans le dossier de production :
   ```bash
   cd /opt/control-tower-v1/current
   ```
2. Synchroniser les fichiers depuis le workspace (exemple pour le dossier `app`) :
   ```bash
   rsync -a /root/.openclaw/workspace/control-tower-v1/app/ ./app/
   rsync -a /root/.openclaw/workspace/control-tower-v1/components/ ./components/
   # Ajoute d'autres dossiers si nécessaire (lib, globals.css, etc.)
   ```
3. Lancer le script de déploiement (qui va build et redémarrer l'application) :
   ```bash
   ./deploy/standalone-release.sh
   ```

---

## 📝 Commandes Utiles

- **Voir les logs de l'application en direct :**
  ```bash
  pm2 logs control-tower-v1
  ```
- **Voir le statut de l'application :**
  ```bash
  pm2 status
  ```
- **Redémarrer l'application manuellement :**
  ```bash
  pm2 restart control-tower-v1
  ```

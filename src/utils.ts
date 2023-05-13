
/* IMPORT */

import * as _ from 'lodash';
import absolute from 'absolute';
import * as findUp from 'find-up';
import * as path from 'path';
import * as pify from 'pify';
// import * as simpleGit from 'simple-git';
import simpleGit from 'simple-git';
import * as vscode from 'vscode';
import * as Commands from './commands';
import Config from './config';

/* UTILS */

const Utils = {

  initCommands ( context: vscode.ExtensionContext ) {
    const { commands } = vscode.extensions.getExtension ( 'linduomin.open-git-remote' ).packageJSON.contributes;

    commands.forEach ( ({ command, title }) => {

      const commandName = _.last ( command.split ( '.' ) ) as string,
            handler = Commands[commandName],
            disposable = vscode.commands.registerCommand ( command, () => handler () );

      context.subscriptions.push ( disposable );

    });

    return Commands;

  },

  folder: {

    getRootPath ( basePath? ) {

      const {workspaceFolders} = vscode.workspace;

      if ( !workspaceFolders ) {return;}

      const firstRootPath = workspaceFolders[0].uri.fsPath;

      if ( !basePath || !absolute ( basePath ) ) {return firstRootPath;}

      const rootPaths = workspaceFolders.map ( folder => folder.uri.fsPath ),
            sortedRootPaths = _.sortBy ( rootPaths, [path => path.length] ).reverse (); // In order to get the closest root

      return sortedRootPaths.find ( rootPath => basePath.startsWith ( rootPath ) );

    },

    async getWrapperPathOf ( rootPath, cwdPath, findPath ) {

      const foundPath = await findUp ( findPath, { cwd: cwdPath } );

      if ( foundPath ) {

        const wrapperPath = path.dirname ( foundPath );

        return wrapperPath;
      }

    }

  },

  repo: {

    getGit ( repopath: string ) {

      return pify ( _.bindAll ( simpleGit( repopath ), ['branch', 'getRemotes'] ) );

    },

    async getHash ( git:any ) {

      return ( await git.revparse ([ 'HEAD' ]) ).trim ();

    },

    async getPath () {

      const {activeTextEditor} = vscode.window,
            editorPath = activeTextEditor && activeTextEditor.document.uri.fsPath,
            rootPath = Utils.folder.getRootPath ( editorPath );

      if ( !rootPath ) {return false;}

      return await Utils.folder.getWrapperPathOf ( rootPath, editorPath || rootPath, '.git' );

    },

    async getBranch ( git ) {

      const config = Config.get ();

      if ( !config.useLocalBranch ) {return config.remote.branch;}

      const branches = await git.branch ();

      return branches.current;

    },

    async getUrl ( git ) {

      const config = Config.get (),
            remotes = await git.getRemotes ( true ),
            remotesGithub = config.github.domain ? remotes.filter ( remote => ( remote.refs.fetch || remote.refs.push ).includes ( config.github.domain ) ) : remotes,
            remoteOrigin = remotesGithub.filter ( remote => remote.name === config.remote.name )[0],
            remote = remoteOrigin || remotesGithub[0];

      if ( !remote ) {return;}

      const ref = remote.refs.fetch || remote.refs.push,
            // re = /\.[^.:/]+[:/]([^/]+)\/(.*?)(?:\.git|\/)?$/,
            re = /^[http|https|ssh]+:\/\/(?:.*?@)?(.*)\b\.git?\b$/; // 匹配 http https Gitab的（ssh）
      let match = re.exec ( ref );

      if ( !match ) {
        // 支持github的ssh
        match = /git@github.com:(.*)\b.git?\b/.exec(ref);
      }
      if (!match) {return;}
      // 去除端口号
      const resultUrl = match[1].replace(/(:[0-9]+)(?:\/){1}/,'/');
      // return `https://${config.github.domain}/${match[1]}/${match[2]}`;
      return `https://${resultUrl}`;

    },

    isGithub (url:string){
      return /github\.com/.test(url);
    }

  }

};

/* EXPORT */

export default Utils;
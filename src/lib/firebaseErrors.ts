import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  friendlyMessage: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function getFriendlyErrorMessage(error: any): string {
  const code = error?.code || '';
  const message = error instanceof Error ? error.message : String(error);
  
  // Auth Errors
  if (code) {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este endereço de e-mail já está registado. Por favor, inicie sessão em vez disso.';
      case 'auth/invalid-email':
        return 'Por favor, introduza um endereço de e-mail válido.';
      case 'auth/user-disabled':
        return 'Esta conta foi desativada. Por favor, contacte o suporte.';
      case 'auth/user-not-found':
        return 'Nenhuma conta corresponde a este endereço de e-mail. Por favor, registe-se.';
      case 'auth/wrong-password':
        return 'Palavra-passe incorreta. Por favor, tente novamente.';
      case 'auth/weak-password':
        return 'A palavra-passe é muito fraca. Por favor, use pelo menos 6 caracteres.';
      case 'auth/invalid-credential':
        return 'Credenciais de login inválidas. Por favor, verifique o seu e-mail e palavra-passe.';
      case 'auth/too-many-requests':
        return 'O acesso a esta conta foi temporariamente desativado devido a muitas tentativas de login falhadas. Por favor, tente novamente mais tarde.';
      case 'auth/popup-closed-by-user':
        return 'O início de sessão com o Google foi fechado antes de ser concluído.';
      case 'auth/operation-not-allowed':
        return 'Esta operação não é permitida. Por favor, certifique-se de que este método de autenticação está ativo no console do Firebase.';
    }
  }

  // Fallback checks on message for Auth
  if (message.includes('auth/email-already-in-use')) return 'Este endereço de e-mail já está registado.';
  if (message.includes('auth/invalid-email')) return 'Por favor, introduza um endereço de e-mail válido.';
  if (message.includes('auth/user-not-found')) return 'Nenhuma conta corresponde a este endereço de e-mail.';
  if (message.includes('auth/wrong-password')) return 'Palavra-passe incorreta. Por favor, tente novamente.';
  if (message.includes('auth/weak-password')) return 'A palavra-passe é muito fraca.';
  if (message.includes('auth/invalid-credential')) return 'Credenciais de login inválidas.';
  if (message.includes('auth/operation-not-allowed')) return 'Esta operação de login/registo não é permitida atualmente.';

  // Firestore Errors
  if (message.includes('permission-denied') || message.includes('insufficient permissions')) {
    if (!auth.currentUser) {
      return 'A sua sessão expirou. Por favor, inicie sessão de novo.';
    }
    return 'Não tem permissão para realizar esta ação. Por favor, contacte o suporte se acredita que isto é um erro.';
  }
  
  if (message.includes('quota-exceeded')) {
    return 'O mercado está muito movimentado de momento. Por favor, tente novamente amanhã.';
  }

  if (message.includes('network-request-failed')) {
    return 'Ligação à rede perdida. Por favor, verifique a sua ligação à internet e tente novamente.';
  }

  if (message.includes('unavailable')) {
    return 'A ligação aos nossos servidores está instável. Por favor, recarregue a página.';
  }

  return message || 'Ocorreu um erro inesperado. Por favor, tente novamente.';
}

export function parseFirestoreError(error: any): string {
  try {
    const info = JSON.parse(error.message) as FirestoreErrorInfo;
    return info.friendlyMessage;
  } catch {
    return getFriendlyErrorMessage(error);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    friendlyMessage: getFriendlyErrorMessage(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

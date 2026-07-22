import React, { createContext, useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// ─── 博众智汇 v2.0 主题上下文 ───
interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
});
export const useTheme = () => useContext(ThemeContext);

// ─── 博众智汇 v2.0 主题 ───
// 与 Bozone 设计系统统一：品牌蓝 #2563eb / 暖灰背景体系 / 圆角规范
const bozoneTheme = {
  token: {
    // 品牌色
    colorPrimary: '#2563eb',
    colorSuccess: '#059669',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorInfo: '#2563eb',
    // 圆角规范 (Bozone: 6px 小标签/按钮, 8px 卡片, 10px 输入框, 14px 模态框)
    borderRadius: 6,
    // 字号
    fontSize: 14,
    // Link 色
    colorLink: '#2563eb',
  },
  components: {
    Table: {
      headerBg: '#faf9f7',
      headerColor: '#4b5563',
      headerSplitColor: 'transparent',
      borderColor: '#e8e5e0',
      borderRadius: 8,
    },
    Card: {
      paddingLG: 20,
      borderRadiusLG: 8,
    },
    Menu: {
      itemBorderRadius: 6,
      subMenuItemBg: 'transparent',
    },
    Button: {
      borderRadius: 6,
      contentFontWeight: 500,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Tag: {
      borderRadius: 4,
    },
    Modal: {
      borderRadiusLG: 10,
    },
  },
};

// 暗色主题下覆盖的组件 token
const darkComponentOverrides = {
  Table: {
    headerBg: '#1e293b',
    headerColor: '#cbd5e1',
    headerSplitColor: 'transparent',
    borderColor: '#334155',
  },
  Card: {},
  Menu: {
    subMenuItemBg: 'transparent',
  },
};

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme_mode') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme_mode', isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    // 同步 body 背景色
    document.body.style.background = isDarkMode ? '#0f172a' : '#f5f3f0';
  }, [isDarkMode]);

  // 初始加载时设置 data-theme 属性
  useEffect(() => {
    const saved = localStorage.getItem('theme_mode');
    document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
    document.body.style.background = saved === 'dark' ? '#0f172a' : '#f5f3f0';
  }, []);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          ...bozoneTheme,
          algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
          components: {
            ...bozoneTheme.components,
            ...(isDarkMode ? darkComponentOverrides : {}),
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeWrapper>
      <App />
    </ThemeWrapper>
  </React.StrictMode>
);
